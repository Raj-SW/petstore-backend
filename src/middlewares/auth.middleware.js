const { AppError } = require('./errorHandler');

// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return next(new AppError('Please log in to access this resource', 401));
};

// Middleware to check if user is a service provider
exports.isServiceProvider = (req, res, next) => {
  if (req.isAuthenticated() && ['veterinarian', 'groomer', 'trainer'].includes(req.user.role)) {
    return next();
  }
  return next(new AppError('Access denied. Service provider role required.', 403));
};

// Middleware to check if user is an admin
exports.isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  return next(new AppError('Access denied. Admin role required.', 403));
};
