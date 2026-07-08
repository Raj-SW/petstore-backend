const crypto = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { escapeRegExp } = require('../utils/sanitize');

// Helper function to validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};

// petTaxi is a fully live professional role — AppointmentPage has a real
// "Pet Taxi" browse tab and detail pages for it. ("Coming soon" only applies
// to the marketing tile on the Services page, a separate area of the site.)
const PROFESSIONAL_ROLES = ['veterinarian', 'groomer', 'trainer', 'petTaxi'];

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v';

const ALLOWED_PROFESSIONAL_SORT_FIELDS = [
  'professionalInfo.rating', 'name', 'createdAt', 'professionalInfo.experience',
];

class ProfessionalService {
  /**
   * Get all professionals with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @param {Object} sorting - Sorting options
   * @returns {Promise<Object>} - Professionals data with pagination info
   */
  async getAllProfessionals(filters = {}, pagination = {}, sorting = {}) {
    const { specialization, role, rating, isActive, city, state } = filters;

    const { page = 1, limit = 10 } = pagination;

    const { sortBy = 'professionalInfo.rating', sortOrder = 'desc' } = sorting;
    const safeSortBy = ALLOWED_PROFESSIONAL_SORT_FIELDS.includes(sortBy)
      ? sortBy
      : 'professionalInfo.rating';

    // Build query for professionals only — always exclude deactivated users
    const query = {
      role: { $in: PROFESSIONAL_ROLES },
      isActive: true,
      'professionalInfo.isActive': { $ne: false },
    };

    // Add filters
    if (specialization) {
      query['professionalInfo.specialization'] = new RegExp(escapeRegExp(specialization), 'i');
    }
    if (role && PROFESSIONAL_ROLES.includes(role)) {
      query.role = role;
    }
    if (rating) {
      query['professionalInfo.rating'] = { $gte: Number.parseFloat(rating) };
    }
    if (isActive !== undefined) {
      query['professionalInfo.isActive'] = isActive === 'true';
    }
    if (city) {
      query['professionalInfo.location.city'] = new RegExp(escapeRegExp(city), 'i');
    }
    if (state) {
      query['professionalInfo.location.state'] = new RegExp(escapeRegExp(state), 'i');
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and sorting
    const professionals = await User.find(query)
      .sort({ [safeSortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(Number.parseInt(limit, 10))
      .select(
        '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
      );

    // Get total count for pagination
    const total = await User.countDocuments(query);

    return {
      professionals: professionals.map((prof) => prof.getProfessionalData()),
      pagination: {
        total,
        page: Number.parseInt(page, 10),
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a single professional by ID
   * @param {string} professionalId - Professional's user ID
   * @returns {Promise<Object>} - Professional data
   */
  async getProfessionalById(professionalId) {
    validateObjectId(professionalId, 'Professional ID');

    const professional = await User.findOne({
      _id: professionalId,
      role: { $in: PROFESSIONAL_ROLES },
      isActive: true,
      'professionalInfo.isActive': { $ne: false },
    }).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    return professional.getProfessionalData();
  }

  /**
   * Update professional information
   * @param {string} professionalId - Professional's user ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated professional data
   */
  async updateProfessional(professionalId, updateData) {
    validateObjectId(professionalId, 'Professional ID');

    // Separate professional info from user info
    const { professionalInfo, ...userInfo } = updateData;

    const updateQuery = { ...userInfo };

    // Handle professional info updates
    if (professionalInfo) {
      Object.keys(professionalInfo).forEach((key) => {
        updateQuery[`professionalInfo.${key}`] = professionalInfo[key];
      });
    }

    const professional = await User.findOneAndUpdate(
      {
        _id: professionalId,
        role: { $in: PROFESSIONAL_ROLES },
      },
      updateQuery,
      {
        new: true,
        runValidators: true,
      }
    ).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    return professional.getProfessionalData();
  }

  /**
   * Get professionals by role/specialization
   * @param {string} role - Professional role
   * @returns {Promise<Array>} - Array of professionals
   */
  async getProfessionalsByRole(role) {
    if (!['veterinarian', 'groomer', 'trainer', 'other', 'all', 'petTaxi'].includes(role)) {
      throw new AppError('Invalid professional role', 400);
    }

    const professionals = await User.find({
      role,
      isActive: true,
      'professionalInfo.isActive': true,
    }).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    return professionals.map((prof) => prof.getProfessionalData());
  }

  /**
   * Get available professionals for a specific time slot
   * @param {Object} timeSlot - Time slot criteria
   * @returns {Promise<Array>} - Available professionals
   */
  async getAvailableProfessionals(timeSlot) {
    const { day, time, role, specialization } = timeSlot;

    const safeRole = PROFESSIONAL_ROLES.includes(role) ? role : null;
    const query = {
      role: safeRole || { $in: PROFESSIONAL_ROLES },
      isActive: true,
      'professionalInfo.isActive': true,
    };

    if (specialization) {
      query['professionalInfo.specialization'] = new RegExp(escapeRegExp(specialization), 'i');
    }

    const professionals = await User.find(query).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    // Filter by availability if day and time are provided
    if (day && time) {
      return professionals
        .filter((prof) => {
          const availability = prof.professionalInfo.availability.get(day);
          if (!availability?.isAvailable) return false;

          const { startTime } = availability;
          const { endTime } = availability;

          return time >= startTime && time <= endTime;
        })
        .map((prof) => prof.getProfessionalData());
    }

    return professionals.map((prof) => prof.getProfessionalData());
  }

  /**
   * Set professional availability
   * @param {string} professionalId - Professional's user ID
   * @param {Object} availability - Availability schedule
   * @returns {Promise<Object>} - Updated professional data
   */
  async setProfessionalAvailability(professionalId, availability) {
    validateObjectId(professionalId, 'Professional ID');

    const professional = await User.findOne({
      _id: professionalId,
      role: { $in: PROFESSIONAL_ROLES },
    });

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    // Validate availability format
    const validDays = new Set([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
    const timeRegex = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

    Object.keys(availability).forEach((day) => {
      if (!validDays.has(day.toLowerCase())) {
        throw new AppError(`Invalid day: ${day}`, 400);
      }

      const schedule = availability[day];
      if (schedule.startTime && !timeRegex.test(schedule.startTime)) {
        throw new AppError(`Invalid start time format for ${day}`, 400);
      }
      if (schedule.endTime && !timeRegex.test(schedule.endTime)) {
        throw new AppError(`Invalid end time format for ${day}`, 400);
      }
    });

    professional.professionalInfo.availability = new Map(Object.entries(availability));
    await professional.save();

    return professional.getProfessionalData();
  }

  /**
   * Toggle professional active status
   * @param {string} professionalId - Professional's user ID
   * @param {boolean} isActive - Active status
   * @returns {Promise<Object>} - Updated professional data
   */
  async toggleProfessionalStatus(professionalId, isActive) {
    validateObjectId(professionalId, 'Professional ID');

    const professional = await User.findOneAndUpdate(
      {
        _id: professionalId,
        role: { $in: PROFESSIONAL_ROLES },
      },
      { 'professionalInfo.isActive': isActive },
      { new: true }
    ).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    return professional.getProfessionalData();
  }

  // ── Admin management ──────────────────────────────────────────────────────

  /**
   * Admin list: all professional roles (incl. petTaxi), with search / role /
   * status filters, pagination and sorting. Sensitive fields stripped.
   */
  async adminListProfessionals(filters = {}, pagination = {}, sorting = {}) {
    const { search, role, status = 'all' } = filters;
    const { page = 1, limit = 20 } = pagination;
    const { sortBy = 'createdAt', sortOrder = 'desc' } = sorting;

    const query = { role: { $in: PROFESSIONAL_ROLES } };
    if (role && PROFESSIONAL_ROLES.includes(role)) {
      query.role = role;
    }
    if (status === 'active') query['professionalInfo.isActive'] = true;
    if (status === 'inactive') query['professionalInfo.isActive'] = false;
    if (search) {
      const rx = new RegExp(escapeRegExp(search), 'i');
      query.$or = [{ name: rx }, { email: rx }, { 'professionalInfo.specialization': rx }];
    }

    const safeSortBy = ALLOWED_PROFESSIONAL_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    const skip = (page - 1) * limit;

    const [professionals, total] = await Promise.all([
      User.find(query)
        .sort({ [safeSortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(Number.parseInt(limit, 10))
        .select(SENSITIVE_FIELDS)
        .lean(),
      User.countDocuments(query),
    ]);

    const pages = Math.ceil(total / limit) || 1;
    return {
      professionals,
      pagination: { total, page: Number.parseInt(page, 10), pages, hasNext: page < pages, hasPrev: page > 1 },
    };
  }

  /**
   * Create a brand-new professional account. Password is a throwaway random
   * value (hashed by the model pre-save hook); a reset token is generated so
   * the invite email can carry a "set your password" link.
   * @returns {Promise<{ user: Object, rawToken: string }>}
   */
  async createProfessionalAccount({ name, email, phoneNumber, address, role, professionalInfo }) {
    if (!PROFESSIONAL_ROLES.includes(role)) {
      throw new AppError('Invalid professional role', 400);
    }
    const rawToken = crypto.randomBytes(32).toString('hex');
    const randomPassword = `${crypto.randomBytes(24).toString('hex')}Aa1*`;
    try {
      const user = await User.create({
        name,
        email,
        phoneNumber,
        address,
        password: randomPassword, // hashed by the model pre('save') hook
        role,
        professionalInfo: { ...professionalInfo, isActive: true },
        passwordResetToken: rawToken,
        passwordResetExpires: Date.now() + 24 * 60 * 60 * 1000, // 24h invite window
      });
      user.password = undefined;
      return { user, rawToken };
    } catch (error) {
      if (error.code === 11000) {
        throw new AppError('Email already exists', 400);
      }
      throw error;
    }
  }

  /**
   * Admin edit of professionalInfo. Returns the lean, nested-shape user
   * (professionalInfo stays nested) so it matches adminListProfessionals —
   * unlike the shared updateProfessional, which flattens via getProfessionalData.
   */
  async adminUpdateProfessional(id, { professionalInfo } = {}) {
    validateObjectId(id, 'Professional ID');
    const updateQuery = {};
    if (professionalInfo) {
      Object.keys(professionalInfo).forEach((key) => {
        updateQuery[`professionalInfo.${key}`] = professionalInfo[key];
      });
    }
    const user = await User.findOneAndUpdate(
      { _id: id, role: { $in: PROFESSIONAL_ROLES } },
      updateQuery,
      { new: true, runValidators: true }
    ).select(SENSITIVE_FIELDS).lean();
    if (!user) throw new AppError('Professional not found', 404);
    return user;
  }

  /**
   * Promote an existing customer to a professional role.
   */
  async promoteUserToProfessional(userId, { role, professionalInfo }) {
    validateObjectId(userId, 'User ID');
    if (!PROFESSIONAL_ROLES.includes(role)) {
      throw new AppError('Invalid professional role', 400);
    }
    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);
    if (user.role !== 'customer') {
      throw new AppError('User is already a professional or admin', 400);
    }
    user.role = role;
    user.professionalInfo = { ...professionalInfo, isActive: true };
    await user.save();
    return User.findById(userId).select(SENSITIVE_FIELDS).lean();
  }

  /**
   * Offboard a professional: demote to customer + deactivate. professionalInfo
   * is preserved so a re-promote is lossless.
   */
  async offboardProfessional(id) {
    validateObjectId(id, 'Professional ID');
    const user = await User.findOneAndUpdate(
      { _id: id, role: { $in: PROFESSIONAL_ROLES } },
      { role: 'customer', 'professionalInfo.isActive': false },
      { new: true }
    ).select(SENSITIVE_FIELDS).lean();
    if (!user) throw new AppError('Professional not found', 404);
    return user;
  }
}

const professionalServiceInstance = new ProfessionalService();
professionalServiceInstance.PROFESSIONAL_ROLES = PROFESSIONAL_ROLES;
module.exports = professionalServiceInstance;
