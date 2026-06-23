const mongoose = require('mongoose');

// Typed announcement system (Epic 9b). Supersedes SaleAnnouncement (kept as
// legacy/read-only). `bucket` is ALWAYS derived from `type` server-side.
const TYPES = ['sale', 'new_product', 'price_drop', 'restock', 'new_tip', 'new_post', 'event', 'general'];
const PROMOTION_TYPES = new Set(['sale', 'new_product', 'price_drop', 'restock']);

// type → opt-in bucket. Exported so the controller/validator share one source.
function bucketForType(type) {
  return PROMOTION_TYPES.has(type) ? 'promotions' : 'news';
}

const announcementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: TYPES, required: true },
    bucket: { type: String, enum: ['promotions', 'news'] },
    subject: { type: String, required: true, trim: true, minlength: 2, maxlength: 150 },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    contentRef: {
      kind: { type: String, enum: ['tip', 'post'] },
      id: { type: mongoose.Schema.Types.ObjectId },
    },
    event: {
      title: String,
      startsAt: Date,
      endsAt: Date,
      location: String,
      description: String,
      link: String,
    },
    cta: {
      label: String,
      url: String,
    },
    audienceCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    source: { type: String, enum: ['inline', 'composer'], required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sentAt: { type: Date },
  },
  { timestamps: true },
);

// Always derive bucket from type — never trust a client-supplied bucket.
announcementSchema.pre('validate', function deriveBucket(next) {
  if (this.type) this.bucket = bucketForType(this.type);
  next();
});

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ type: 1 });

module.exports =
  mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema);
module.exports.TYPES = TYPES;
module.exports.bucketForType = bucketForType;
