const mongoose = require('mongoose');

const ANIMAL_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'reptile', 'other'];
const CATEGORIES = ['nutrition', 'grooming', 'health', 'training', 'exercise', 'dental', 'behavior'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const petCareTipSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tip title is required'],
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
      url: { type: String, trim: true, default: '' },
      publicId: { type: String, trim: true, default: '' },
    },
    body: {
      type: String,
      required: [true, 'Tip body is required'],
    },
    sections: [
      {
        heading: { type: String, trim: true, maxlength: 150 },
        body: { type: String },
        order: { type: Number, default: 0 },
        images: {
          type: [{ url: String, publicId: String }],
          default: [],
          validate: {
            validator: (arr) => arr.length <= 8,
            message: 'A section can have at most 8 images',
          },
        },
      },
    ],
    animalType: {
      type: String,
      enum: { values: ANIMAL_TYPES, message: 'Invalid animal type' },
      required: [true, 'Animal type is required'],
    },
    category: {
      type: String,
      enum: { values: CATEGORIES, message: 'Invalid category' },
      required: [true, 'Category is required'],
    },
    breed: {
      type: String,
      trim: true,
      default: '',
    },
    difficulty: {
      type: String,
      enum: { values: DIFFICULTIES, message: 'Invalid difficulty' },
      default: 'beginner',
    },
    readTime: {
      type: Number,
      min: 1,
      default: 1,
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

petCareTipSchema.pre('save', function (next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  if (this.isModified('body')) {
    // readTime = stripped word count at 200 wpm, minimum 1 minute
    const words = this.body
      .replace(/<[^>]{0,2048}>/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    this.readTime = Math.max(1, Math.round(words / 200));
  }
  next();
});

petCareTipSchema.index({ animalType: 1, category: 1 });
petCareTipSchema.index({ published: 1, featured: 1 });
petCareTipSchema.index({ title: 'text' });

petCareTipSchema.statics.ANIMAL_TYPES = ANIMAL_TYPES;
petCareTipSchema.statics.CATEGORIES = CATEGORIES;
petCareTipSchema.statics.DIFFICULTIES = DIFFICULTIES;

module.exports = mongoose.models.PetCareTip || mongoose.model('PetCareTip', petCareTipSchema);
