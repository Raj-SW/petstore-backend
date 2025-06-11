const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { AppError } = require('../middlewares/errorHandler');
const User = require('../models/user.model');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const passport = require('passport');

// Generate tokens
const generateTokens = (user) => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  return { accessToken, refreshToken };
};

// Register new user
exports.signup = async (req, res, next) => {
  try {
    const { name, email, phoneNumber, address, password, role = 'customer' } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already registered', 400));
    }

    // Create user
    const user = await User.create({
      name,
      email,
      phoneNumber,
      address,
      password,
      role,
    });

    // Remove password from response
    user.password = undefined;

    // Log in the user after registration
    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      res.status(201).json({
        success: true,
        message: 'Registration successful',
        data: user,
      });
    });
  } catch (error) {
    next(error);
  }
};

// Login user
exports.login = (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return next(new AppError(info.message || 'Invalid credentials', 401));
    }

    req.login(user, (err) => {
      if (err) {
        return next(err);
      }
      // Remove password from response
      user.password = undefined;
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: user,
      });
    });
  })(req, res, next);
};

// Logout user
exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  });
};

// Get current user
exports.getCurrentUser = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated',
    });
  }

  // Remove password from response
  const user = { ...req.user.toObject() };
  delete user.password;

  res.status(200).json({
    success: true,
    data: user,
  });
};

// Refresh token
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return next(new AppError('Refresh token is required', 400));
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Get user
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    res.status(200).json({
      success: true,
      data: tokens,
    });
  } catch (error) {
    next(new AppError('Invalid refresh token', 401));
  }
};

// Forgot password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    // Send reset email
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    await sendEmail({
      email: user.email,
      subject: 'Password Reset',
      message: `Reset your password by clicking: ${resetUrl}`,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError('Invalid or expired reset token', 400));
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    next(error);
  }
};

// Verify email
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(new AppError('Invalid or expired verification token', 400));
    }

    // Update user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Resend verification email
exports.resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    if (user.isEmailVerified) {
      return next(new AppError('Email already verified', 400));
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const verificationUrl = `${req.protocol}://${req.get(
      'host'
    )}/api/auth/verify-email/${verificationToken}`;

    await sendEmail({
      email: user.email,
      subject: 'Email Verification',
      message: `Please verify your email by clicking: ${verificationUrl}`,
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
};
