const jwt = require('jsonwebtoken');

const PURPOSE = 'unsubscribe';
const LEGACY_PURPOSE = 'unsubscribe-sales'; // tokens minted before Epic 9b

// bucket → emailPreferences field that the unsubscribe link should flip.
const BUCKET_FIELD = { promotions: 'sales', news: 'news' };

// Long-lived, single-purpose token embedded in marketing emails. The bucket
// defaults to 'promotions' so legacy call sites keep working.
exports.makeUnsubscribeToken = (userId, bucket = 'promotions') =>
  jwt.sign({ id: userId.toString(), purpose: PURPOSE, bucket }, process.env.JWT_SECRET, {
    expiresIn: '180d',
  });

// Returns { userId, bucket, field } or null if invalid/expired/wrong-purpose.
// Legacy 'unsubscribe-sales' tokens resolve to the promotions bucket.
exports.verifyUnsubscribeToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.purpose !== PURPOSE && decoded.purpose !== LEGACY_PURPOSE) return null;
    const bucket = decoded.bucket && BUCKET_FIELD[decoded.bucket] ? decoded.bucket : 'promotions';
    return { userId: decoded.id, bucket, field: BUCKET_FIELD[bucket] };
  } catch {
    return null;
  }
};

exports.BUCKET_FIELD = BUCKET_FIELD;
