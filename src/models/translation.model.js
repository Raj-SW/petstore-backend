const mongoose = require('mongoose');

/**
 * Cache of machine translations, keyed by source text + target language.
 *
 * The point is to call the provider once per distinct string, ever. The free
 * tiers are day-limited on characters, so translating per visitor would burn
 * through them immediately and get slower for everyone.
 */
const translationSchema = new mongoose.Schema(
  {
    // Hash of the source text — indexed instead of the text itself, which can
    // exceed the 1024-byte index key limit on long paragraphs.
    hash: { type: String, required: true, index: true },
    source: { type: String, required: true },
    target: { type: String, required: true, enum: ['fr', 'en'] },
    text: { type: String, required: true },
    provider: { type: String, default: 'unknown' },
    // Set when a human corrects the machine output; protected from overwrite.
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

translationSchema.index({ hash: 1, target: 1 }, { unique: true });

module.exports =
  mongoose.models.Translation || mongoose.model('Translation', translationSchema);
