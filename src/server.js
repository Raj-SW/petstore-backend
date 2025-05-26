const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./utils/logger');

// Load environment variables
require('dotenv').config();

// Connect to MongoDB
connectDB();

// Start server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
