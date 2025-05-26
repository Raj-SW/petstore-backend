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
  } else {
    // Production mode
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Programming or unknown errors: don't leak error details
      logger.error('Error 💥', err);
      res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
      });
    }
  }
};

const notFoundHandler = (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
};

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
};
