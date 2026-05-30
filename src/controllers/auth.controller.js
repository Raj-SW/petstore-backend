const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { AppError } = require('../middlewares/errorHandler');
const User = require('../models/user.model');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

// Generate tokens
const generateTokens = (user) => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  return { accessToken, refreshToken };
};

// Register new user — does NOT auto-login; user must call /login separately
const signup = async (req, res, next) => {
  try {
    const { name, email, phoneNumber, address, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already registered', 400));
    }

    const user = await User.create({
      name,
      email,
      phoneNumber,
      address,
      password,
      role: 'customer',
    });

    user.password = undefined;

    // Welcome email — non-critical
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome to VitalPaws! 🐾',
        template: 'welcome',
        data: {
          name: user.name,
          shopUrl: `${process.env.FRONTEND_URL}/petshop`,
        },
      });
    } catch (emailErr) {
      logger.warn('Welcome email failed (non-fatal)', { error: emailErr.message });
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please sign in.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// Login user — returns JWT access token
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // findOne with +password because password field has select: false on the schema
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Invalid email or password', 401));
    }

    // Access token only — no refresh token (24h stateless JWT, per auth design).
    // Users re-authenticate after expiry. See generateTokens() for refresh token generation
    // if a refresh flow is added in future.
    const accessToken = user.generateAuthToken();

    // Don't send password in response
    user.password = undefined;

    // Login notification email — non-critical
    try {
      await sendEmail({
        to: user.email,
        subject: 'New sign-in to your VitalPaws account',
        template: 'login-notification',
        data: {
          name: user.name,
          loginTime: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
          resetUrl: `${process.env.FRONTEND_URL}/reset-password`,
        },
      });
    } catch (emailErr) {
      logger.warn('Login notification email failed (non-fatal)', { error: emailErr.message });
    }

    // Note: login response wraps { user, accessToken } in data — intentional,
    // as login returns two things. Frontend destructures data.user and data.accessToken.
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user, accessToken },
    });
  } catch (error) {
    next(error);
  }
};

// Logout — stateless, client clears the token; server just acknowledges
const logout = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

// Get current user
const getCurrentUser = (req, res) => {
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
const refreshToken = async (req, res, next) => {
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
const forgotPassword = async (req, res, next) => {
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
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Password reset email — critical: re-throw if it fails so user knows to retry
    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your VitalPaws password',
        template: 'password-reset',
        data: {
          name: user.name,
          resetUrl,
        },
      });
    } catch (emailErr) {
      logger.warn('Password reset email failed', { error: emailErr.message });
      throw emailErr;
    }

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    next(error);
  }
};

// Reset password
const resetPassword = async (req, res, next) => {
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
const verifyEmail = async (req, res, next) => {
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
const resendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('No user found with that email', 404));
    }

    if (user.isEmailVerified) {
      return next(new AppError('Email is already verified', 400));
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Verification email — critical: re-throw if it fails so user knows to retry
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify your VitalPaws email',
        template: 'password-reset',
        data: {
          name: user.name,
          resetUrl: verificationUrl,
        },
      });
    } catch (emailErr) {
      logger.warn('Verification email failed', { error: emailErr.message });
      throw emailErr;
    }

    res.status(200).json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  signup,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
};
