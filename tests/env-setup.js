/**
 * Jest setupFiles entry — runs in every test worker before the test framework loads.
 *
 * 1. Loads .env.test for non-DB environment variables (JWT secrets, etc.)
 * 2. Reads the MongoMemoryServer URI written by globalSetup and sets MONGODB_URI.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

// Load test env vars (JWT secrets, etc.) from .env.test
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.test') });

// Read the MongoDB URI from the temp file created by globalSetup
const MONGO_URI_FILE = path.join(os.tmpdir(), '__jest_mongo_uri__');
try {
  const uri = fs.readFileSync(MONGO_URI_FILE, 'utf8').trim();
  if (uri) {
    process.env.MONGODB_URI = uri;
  }
} catch {
  // File may not exist if tests are run without globalSetup — MONGODB_URI will be undefined
}
