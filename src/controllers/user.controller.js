const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const {
  uploadMultipleToCloudinary,
  deleteMultipleFromCloudinary,
  validateImageFile,
} = require('../utils/cloudinary');

// Get user profile
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Update user profile
exports.updateProfile = async (req, res, next) => {
  try {
    const {
      name, email, phoneNumber, address, emailPreferences,
    } = req.body;

    // Don't allow password updates through this route
    if (req.body.password) {
      return next(
        new AppError('This route is not for password updates. Please use /change-password', 400),
      );
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await User.findOne({ email: String(email), _id: { $ne: req.user.id } });
      if (existingUser) {
        return next(new AppError('Email is already in use', 400));
      }
    }

    const update = {
      name, email, phoneNumber, address,
    };
    if (emailPreferences && typeof emailPreferences.sales === 'boolean') {
      update['emailPreferences.sales'] = emailPreferences.sales;
    }
    if (emailPreferences && typeof emailPreferences.news === 'boolean') {
      update['emailPreferences.news'] = emailPreferences.news;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      update,
      { new: true, runValidators: true },
    ).select('-password');

    res.status(200).json({
      status: 'success',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Change password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    // Check if current password is correct
    const isPasswordCorrect = await user.comparePassword(currentPassword);
    if (!isPasswordCorrect) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Upload avatar
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded. Please provide an image file with field name "avatar".', 400));
    }

    // Validate image file
    validateImageFile(req.file);

    // Fetch the current user to check for existing profileImage
    const user = await User.findById(req.user.id);

    // Delete old Cloudinary image if present
    if (user.profileImage?.publicId) {
      await deleteMultipleFromCloudinary([user.profileImage.publicId]);
    }

    // Upload new image
    const [uploaded] = await uploadMultipleToCloudinary([req.file], 'avatars');

    // Persist the new image data
    user.profileImage = { url: uploaded.url, publicId: uploaded.publicId };
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      data: { profileImage: uploaded.url },
    });
  } catch (error) {
    next(error);
  }
};

// Delete account
exports.deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.user.id);

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};
