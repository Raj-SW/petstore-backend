const mongoose = require('mongoose');

const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');

// Helper function to validate ObjectId
const validateObjectId = (id, fieldName = 'ID') => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, 400);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, 400);
  }
};

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

    // Build query for professionals only
    const query = {
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    };

    // Add filters
    if (specialization) {
      query['professionalInfo.specialization'] = new RegExp(specialization, 'i');
    }
    if (role && ['veterinarian', 'groomer', 'trainer'].includes(role)) {
      query.role = role;
    }
    if (rating) {
      query['professionalInfo.rating'] = { $gte: parseFloat(rating) };
    }
    if (isActive !== undefined) {
      query['professionalInfo.isActive'] = isActive === 'true';
    }
    if (city) {
      query['professionalInfo.location.city'] = new RegExp(city, 'i');
    }
    if (state) {
      query['professionalInfo.location.state'] = new RegExp(state, 'i');
    }

    // Calculate skip value for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and sorting
    const professionals = await User.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .select(
        '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
      );

    // Get total count for pagination
    const total = await User.countDocuments(query);

    return {
      professionals: professionals.map((prof) => prof.getProfessionalData()),
      pagination: {
        total,
        page: parseInt(page, 10),
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
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
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
        role: { $in: ['veterinarian', 'groomer', 'trainer'] },
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

    const query = {
      role: role || { $in: ['veterinarian', 'groomer', 'trainer'] },
      'professionalInfo.isActive': true,
    };

    if (specialization) {
      query['professionalInfo.specialization'] = new RegExp(specialization, 'i');
    }

    const professionals = await User.find(query).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v'
    );

    // Filter by availability if day and time are provided
    if (day && time) {
      return professionals
        .filter((prof) => {
          const availability = prof.professionalInfo.availability.get(day);
          if (!availability || !availability.isAvailable) return false;

          const { startTime } = availability;
          const { endTime } = availability;

          return time >= startTime && time <= endTime;
        })
        .map((prof) => prof.getProfessionalData());
    }

    return professionals.map((prof) => prof.getProfessionalData());
  }

  /**
   * Update professional rating
   * @param {string} professionalId - Professional's user ID
   * @param {number} newRating - New rating to add
   * @returns {Promise<Object>} - Updated professional data
   */
  async updateProfessionalRating(professionalId, newRating) {
    validateObjectId(professionalId, 'Professional ID');

    const professional = await User.findOne({
      _id: professionalId,
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    });

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    const currentRating = professional.professionalInfo.rating || 0;
    const currentReviewCount = professional.professionalInfo.reviewCount || 0;

    // Calculate new average rating
    const totalRating = currentRating * currentReviewCount + newRating;
    const newReviewCount = currentReviewCount + 1;
    const newAverageRating = totalRating / newReviewCount;

    professional.professionalInfo.rating = Math.round(newAverageRating * 10) / 10; // Round to 1 decimal
    professional.professionalInfo.reviewCount = newReviewCount;

    await professional.save();

    return professional.getProfessionalData();
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
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    });

    if (!professional) {
      throw new AppError('Professional not found', 404);
    }

    // Validate availability format
    const validDays = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

    Object.keys(availability).forEach((day) => {
      if (!validDays.includes(day.toLowerCase())) {
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
        role: { $in: ['veterinarian', 'groomer', 'trainer'] },
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
}

module.exports = new ProfessionalService();
