require('dotenv').config();
const app = require('../src/app');
const connectDB = require('../src/config/database');

// Connect to MongoDB once (cached across invocations)
connectDB();

// Export the Express app for Vercel serverless
module.exports = app;
