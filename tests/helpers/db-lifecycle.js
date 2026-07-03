/**
 * Shared DB lifecycle for the integration project (wired via `setupFilesAfterEnv`).
 *
 * Each Jest worker process gets its own logical MongoDB database within the
 * shared in-memory replica set, keyed by JEST_WORKER_ID. This is required
 * because Jest runs multiple worker processes concurrently (once --runInBand
 * is dropped from test:integration) — without per-worker isolation, one
 * worker's "clear every collection before each test" would wipe data another
 * worker's concurrently-running test just inserted, since they'd otherwise
 * all point at the exact same physical database.
 *
 * MongoMemoryReplSet.getUri() (see tests/helpers/setup.js) returns a URI with
 * no database name in the path, e.g. "mongodb://127.0.0.1:PORT/?replicaSet=testset" —
 * the worker-specific db name is inserted via the URL API (not string
 * concatenation, which would corrupt the query string).
 *
 * This module also:
 *   - connects the default mongoose connection once per test file (idempotent —
 *     each test file gets a fresh mongoose module instance, so this fires once
 *     per file, safely reusing the same per-worker database across files
 *     handled by the same worker), and
 *   - clears EVERY collection in that worker's database before each test.
 *
 * Per-file connect is redundant (kept files still work — connect is a no-op
 * when already connected); per-file `deleteMany` calls are harmless.
 */
const mongoose = require('mongoose');

function buildWorkerUri() {
  const workerId = process.env.JEST_WORKER_ID || '1';
  const url = new URL(process.env.MONGODB_URI);
  url.pathname = `/test_worker_${workerId}`;
  return url.toString();
}

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(buildWorkerUri());
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});
