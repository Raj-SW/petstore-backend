/**
 * Script: unfeature-all-products.js
 *
 * Sets isFeatured = false on every product in the database.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   node scripts/unfeature-all-products.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not set in .env');
  process.exit(1);
}

async function run() {
  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅  Connected.');

  const result = await mongoose.connection
    .collection('products')
    .updateMany(
      { isFeatured: true },         // only touch products that are currently featured
      { $set: { isFeatured: false } }
    );

  console.log(`✅  Done. ${result.matchedCount} product(s) matched, ${result.modifiedCount} updated.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌  Script failed:', err.message);
  process.exit(1);
});
