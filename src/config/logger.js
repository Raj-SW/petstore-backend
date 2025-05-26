const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const loggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'petstore-api' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: process.env.LOG_MAX_SIZE || 5242880, // 5MB
      maxFiles: process.env.LOG_MAX_FILES || 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: process.env.LOG_MAX_SIZE || 5242880,
      maxFiles: process.env.LOG_MAX_FILES || 5,
    }),
  ],
};

if (process.env.NODE_ENV !== 'production') {
  loggerConfig.transports.push(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    })
  );
}

module.exports = loggerConfig;
