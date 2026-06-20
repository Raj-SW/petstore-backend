const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Question is required'],
      trim: true,
      minlength: [2, 'Question must be at least 2 characters'],
      maxlength: [300, 'Question cannot exceed 300 characters'],
    },
    answer: {
      type: String,
      required: [true, 'Answer is required'],
      trim: true,
      minlength: [2, 'Answer must be at least 2 characters'],
      maxlength: [2000, 'Answer cannot exceed 2000 characters'],
    },
    order: {
      type: Number,
      default: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

faqSchema.index({ active: 1, order: 1 });

module.exports = mongoose.models.Faq || mongoose.model('Faq', faqSchema);
