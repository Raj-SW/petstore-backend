const mongoose = require('mongoose');

const bcrypt = require('bcryptjs');
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

class UserService {
  /**
   * Create a new user (customer or professional)
   * @param {Object} userData - User data
   * @returns {Promise<Object>} - Created user data
   */
  async createUser(userData) {
    const { role, professionalInfo, ...baseUserData } = userData;

    // Validate professional data if role is professional
    if (['veterinarian', 'groomer', 'trainer'].includes(role)) {
      if (
        !professionalInfo
        || !professionalInfo.specialization
        || professionalInfo.experience === undefined
      ) {
        throw new AppError('Professional information is required for professional roles', 400);
      }
    }

    const user = new User({
      ...baseUserData,
      role,
      professionalInfo: ['veterinarian', 'groomer', 'trainer'].includes(role)
        ? professionalInfo
        : undefined,
    });

    await user.save();

    // Return appropriate data based on role
    if (user.isProfessional) {
      return user.getProfessionalData();
    }
    return user.getCustomerData();
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @param {boolean} includeProfessionalInfo - Whether to include professional info
   * @returns {Promise<Object>} - User data
   */
  async getUserById(userId, includeProfessionalInfo = false) {
    validateObjectId(userId, 'User ID');

    const user = await User.findById(userId).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v',
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isProfessional && includeProfessionalInfo) {
      return user.getProfessionalData();
    }
    return user.getCustomerData();
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object>} - Updated user data
   */
  async updateUserProfile(userId, updateData) {
    validateObjectId(userId, 'User ID');

    const { professionalInfo, ...userInfo } = updateData;

    const updateQuery = { ...userInfo };

    // Handle professional info updates
    if (professionalInfo) {
      Object.keys(professionalInfo).forEach((key) => {
        updateQuery[`professionalInfo.${key}`] = professionalInfo[key];
      });
    }

    const user = await User.findByIdAndUpdate(userId, updateQuery, {
      new: true,
      runValidators: true,
    }).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v',
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isProfessional) {
      return user.getProfessionalData();
    }
    return user.getCustomerData();
  }

  /**
   * Change user password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Success message
   */
  async changePassword(userId, currentPassword, newPassword) {
    validateObjectId(userId, 'User ID');

    const user = await User.findById(userId).select('+password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    user.password = newPassword;
    await user.save();

    return { message: 'Password updated successfully' };
  }

  /**
   * Get all users with filtering
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Promise<Object>} - Users data with pagination
   */
  async getAllUsers(filters = {}, pagination = {}) {
    const { role, isEmailVerified, search } = filters;

    const { page = 1, limit = 10 } = pagination;

    const query = {};

    if (role) {
      query.role = role;
    }
    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === 'true';
    }
    if (search) {
      query.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];
    }

    const skip = (page - 1) * limit;

    const users = await User.find(query)
      .select(
        '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v',
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10));

    const total = await User.countDocuments(query);

    return {
      users: users.map((user) => {
        if (user.isProfessional) {
          return user.getProfessionalData();
        }
        return user.getCustomerData();
      }),
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
   * Delete user account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Success message
   */
  async deleteUser(userId) {
    validateObjectId(userId, 'User ID');

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return { message: 'User account deleted successfully' };
  }

  /**
   * Verify user email
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Updated user data
   */
  async verifyEmail(userId) {
    validateObjectId(userId, 'User ID');

    const user = await User.findByIdAndUpdate(
      userId,
      {
        isEmailVerified: true,
        emailVerificationToken: undefined,
        emailVerificationExpires: undefined,
      },
      { new: true },
    ).select(
      '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires -__v',
    );

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.isProfessional) {
      return user.getProfessionalData();
    }
    return user.getCustomerData();
  }

  /**
   * Get user statistics (for admin dashboard)
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStatistics() {
    const totalUsers = await User.countDocuments();
    const totalCustomers = await User.countDocuments({ role: 'customer' });
    const totalProfessionals = await User.countDocuments({
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
    });
    const verifiedUsers = await User.countDocuments({ isEmailVerified: true });
    const activeProfessionals = await User.countDocuments({
      role: { $in: ['veterinarian', 'groomer', 'trainer'] },
      'professionalInfo.isActive': true,
    });

    const professionalsByRole = await User.aggregate([
      {
        $match: {
          role: { $in: ['veterinarian', 'groomer', 'trainer'] },
        },
      },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalUsers,
      totalCustomers,
      totalProfessionals,
      verifiedUsers,
      activeProfessionals,
      professionalsByRole: professionalsByRole.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
    };
  }
}

module.exports = new UserService();
