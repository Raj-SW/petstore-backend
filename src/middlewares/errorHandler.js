const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    logger.error('Error 💥', err);
    res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  } else if (err.isOperational) {
    // Production mode — operational errors are safe to surface
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Production mode — programming/unknown errors: don't leak error details
    logger.error('Error 💥', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};

// Factory helper used by validateRequest and professionalController. Mirrors the
// (statusCode, message) argument order those call sites expect. Without this the
// `createError` import resolves to undefined and validation failures throw a
// TypeError (surfacing as a 500 instead of the intended 4xx).
const createError = (statusCode, message) => new AppError(message, statusCode);

module.exports = {
  AppError,
  createError,
  errorHandler,
  notFoundHandler,
};
