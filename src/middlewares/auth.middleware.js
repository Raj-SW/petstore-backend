// backend/src/middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const User = require('../models/user.model');

// Authenticate via Bearer token in Authorization header
exports.isAuthenticated = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Please log in to access this resource', 401));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User no longer exists', 401));
    }

    if (!user.isActive) {
      return next(new AppError('Your account has been deactivated. Please contact support.', 403));
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Invalid or expired token. Please log in again.', 401));
    }
    return next(error); // DB or other unexpected error — let global error handler deal with it
  }
};

// Must come after isAuthenticated in the middleware chain
exports.isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return next(new AppError('Access denied. Admin role required.', 403));
};

// Guards routes that require a bookable service provider role.
// Note: 'petTaxi' is intentionally excluded — petTaxi drivers are professionals
// (isProfessional virtual = true) but do not have bookable service slots via these routes.
exports.isServiceProvider = (req, res, next) => {
  if (req.user && ['veterinarian', 'groomer', 'trainer'].includes(req.user.role)) {
    return next();
  }
  return next(new AppError('Access denied. Service provider role required.', 403));
};