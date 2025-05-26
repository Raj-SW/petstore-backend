const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide category name'],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    image: {
      url: String,
      public_id: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create slug from name
categorySchema.pre('save', function (next) {
  this.slug = this.name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-');
  next();
});

// Virtual for subcategories
categorySchema.virtual('subcategories', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
});

// Index for search
categorySchema.index({ name: 'text', description: 'text' });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category; 