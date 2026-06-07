/**
 * Script: normalize-categories.js
 *
 * Normalises legacy singular category values to the plural form
 * used by the current admin form (CATEGORIES = ["dogs","cats","fish","birds","general","apparel"]).
 *
 * Mappings applied:
 *   "cat"       → "cats"
 *   "dog"       → "dogs"
 *   "bird"      → "birds"
 *   "small pet" → "small pets"   (just in case)
 *
 * Usage:
 *   node scripts/normalize-categories.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not set in .env');
  process.exit(1);
}

const MAPPING = {
  cat:        'cats',
  dog:        'dogs',
  bird:       'birds',
  'small pet': 'small pets',
};

async function run() {
  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI);
  console.log('✅  Connected.\n');

  const col = mongoose.connection.collection('products');

  let totalUpdated = 0;

  for (const [bad, good] of Object.entries(MAPPING)) {
    const result = await col.updateMany(
      { categories: bad },
      { $set: { 'categories.$[elem]': good } },
      { arrayFilters: [{ elem: bad }] }
    );
    if (result.modifiedCount > 0) {
      console.log(`  "${bad}" → "${good}"  (${result.modifiedCount} product(s) updated)`);
      totalUpdated += result.modifiedCount;
    } else {
      console.log(`  "${bad}" → "${good}"  (none found)`);
    }
  }

  // Verify: show remaining distinct values
  const distinct = await col.distinct('categories');
  console.log('\n✅  Done. Total products updated:', totalUpdated);
  console.log('📋  Distinct categories now in DB:', distinct);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('❌  Script failed:', err.message);
  process.exit(1);
});
