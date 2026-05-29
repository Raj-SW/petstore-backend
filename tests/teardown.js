/**
 * Jest Global Teardown
 * Stops the in-memory MongoDB replica set after all tests have run.
 *
 * Note: globalSetup and globalTeardown run in separate Node.js VMs in Jest,
 * so global.__MONGOD__ may or may not be available here depending on Jest version.
 * If not available, the mongod process is cleaned up by OS on Jest exit.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const MONGO_URI_FILE = path.join(os.tmpdir(), '__jest_mongo_uri__');

module.exports = async () => {
  // Try to stop via global reference (available in some Jest configurations)
  if (global.__MONGOD__) {
    try {
      await global.__MONGOD__.stop();
    } catch {
      // ignore errors during stop
    }
  }

  // Clean up temp URI file
  try {
    fs.unlinkSync(MONGO_URI_FILE);
  } catch {
    // ignore if already deleted
  }
};
