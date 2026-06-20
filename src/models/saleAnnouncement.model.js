const mongoose = require('mongoose');

const saleAnnouncementSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      minlength: [2, 'Subject must be at least 2 characters'],
      maxlength: [150, 'Subject cannot exceed 150 characters'],
    },
    message: {
      type: String,
      trim: true,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      default: '',
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    audienceCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    source: {
      type: String,
      enum: { values: ['inline', 'composer'], message: 'Invalid source' },
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

saleAnnouncementSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.SaleAnnouncement || mongoose.model('SaleAnnouncement', saleAnnouncementSchema);
