/**
 * Shared DB lifecycle for the integration project (wired via `setupFilesAfterEnv`).
 *
 * The previous pattern let every test file manage its own connection and clear
 * only the handful of collections it happened to know about. Under --runInBand
 * that leaked state across files (fixed-email fixtures collided with E11000
 * duplicate-key errors, which aborted setup and left auth tokens undefined).
 *
 * This module centralises isolation:
 *   - connect the default mongoose connection once per worker (idempotent), and
 *   - clear EVERY collection before each test, so no state survives across
 *     tests or files.
 *
 * Per-file connect is now redundant (kept files still work — connect is a
 * no-op when already connected); per-file `deleteMany` calls are harmless.
 */
const mongoose = require('mongoose');

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

beforeEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({})),
  );
});
