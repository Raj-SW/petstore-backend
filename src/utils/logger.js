const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// File transports are only used in local development.
// Production / serverless environments (Vercel, Render, etc.) have
// read-only filesystems — console-only logging is used there.
const isDevelopment = process.env.NODE_ENV === 'development';

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({
        timestamp, level, message, ...meta
      }) => `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`),
    ),
  }),
];

if (isDevelopment) {
  try {
    const fs = require('fs');
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    transports.push(
      new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
      }),
      new winston.transports.File({
        filename: path.join(logsDir, 'combined.log'),
      }),
    );
  } catch {
    // If log directory can't be created, fall back to console-only
  }
}

// Create logger instance
const logger = winston.createLogger({
  level: isDevelopment ? 'debug' : 'info',
  format: logFormat,
  transports,
});

// Create a stream object for Morgan
logger.stream = {
  write: (message) => logger.info(message.trim()),
};

module.exports = logger;
