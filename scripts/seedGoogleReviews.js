const mongoose = require('mongoose');
const { GOOGLE_REVIEWS_SEED, TEST_ENTRY_NAMES } = require('../src/data/googleReviews.seed');

// Idempotent: skip a review already present (same name + message + google source).
async function seedGoogleReviews(FeedbackModel) {
  let inserted = 0;
  let skipped = 0;
  for (const r of GOOGLE_REVIEWS_SEED) {
    const exists = await FeedbackModel.findOne({ source: 'google', name: r.name, message: r.message });
    if (exists) { skipped += 1; continue; }
    await FeedbackModel.create({ ...r, source: 'google', approved: true });
    inserted += 1;
  }
  const del = await FeedbackModel.deleteMany({ name: { $in: TEST_ENTRY_NAMES } });
  return { inserted, skipped, removed: del.deletedCount || 0 };
}

module.exports = { seedGoogleReviews };

// Self-run: `node scripts/seedGoogleReviews.js`
if (require.main === module) {
  (async () => {
    const Feedback = require('../src/models/feedback.model');
    await mongoose.connect(process.env.MONGODB_URI);
    const res = await seedGoogleReviews(Feedback);
    // eslint-disable-next-line no-console
    console.log('Seed complete:', res);
    await mongoose.connection.close();
    process.exit(0);
  })().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', e);
    process.exit(1);
  });
}
