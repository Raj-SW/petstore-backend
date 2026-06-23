const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    role: {
      type: String,
      trim: true,
      maxlength: [80, 'Role cannot exceed 80 characters'],
      default: '',
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [5, 'Message must be at least 5 characters'],
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
    },
    photos: {
      type: [{ url: String, publicId: String }],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 3,
        message: 'A feedback can have at most 3 photos',
      },
    },
    approved: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
