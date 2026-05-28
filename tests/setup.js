/**
 * Jest Global Setup
 * Starts an in-memory MongoDB replica set (required for transactions) and
 * makes the URI available to test workers.
 *
 * Jest globalSetup and globalTeardown run in separate Node.js processes, so
 * the URI is written to a temp file so setupFiles can read it in test workers.
 */

const { MongoMemoryReplSet } = require('mongodb-memory-server');
const os = require('os');
const path = require('path');
const fs = require('fs');

const MONGO_URI_FILE = path.join(os.tmpdir(), '__jest_mongo_uri__');

module.exports = async () => {
  // Use a 1-node replica set so Mongoose multi-document transactions work
  // (required by the order controller which uses session.startTransaction())
  const mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });

  const uri = mongod.getUri();

  // Persist server instance for teardown (works if same VM context)
  global.__MONGOD__ = mongod;

  // Write URI to temp file so test workers can read it via setupFiles
  fs.writeFileSync(MONGO_URI_FILE, uri);

  // Also set on process.env for the globalSetup process itself
  process.env.MONGODB_URI = uri;
};
