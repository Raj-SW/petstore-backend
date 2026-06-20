const mongoose = require('mongoose');

const CATEGORIES = ['event', 'community', 'award', 'announcement', 'behind_the_scenes'];

const galleryPostSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    coverImage: {
      type: String,
      trim: true,
      default: '',
    },
    body: {
      type: String,
      required: [true, 'Body is required'],
    },
    sections: [
      {
        heading: { type: String, trim: true, maxlength: 150 },
        body: { type: String },
        order: { type: Number, default: 0 },
      },
    ],
    excerpt: {
      type: String,
      trim: true,
      maxlength: [300, 'Excerpt cannot exceed 300 characters'],
      default: '',
    },
    category: {
      type: String,
      enum: { values: CATEGORIES, message: 'Invalid category' },
      required: [true, 'Category is required'],
    },
    eventDate: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [160, 'Location cannot exceed 160 characters'],
      default: '',
    },
    tags: {
      type: [String],
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    published: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

galleryPostSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))];
  }
  if (!this.excerpt && this.body) {
    this.excerpt = this.body
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 160);
  }
  next();
});

galleryPostSchema.index({ category: 1, published: 1 });
galleryPostSchema.index({ featured: 1, published: 1 });
galleryPostSchema.statics.CATEGORIES = CATEGORIES;

module.exports = mongoose.models.GalleryPost || mongoose.model('GalleryPost', galleryPostSchema);
