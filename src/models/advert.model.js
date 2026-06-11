const mongoose = require('mongoose');

const PLACEMENTS = ['banner', 'sponsored'];

const advertSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Advert title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    link: {
      type: String,
      required: [true, 'Advert link is required'],
      trim: true,
    },
    placement: {
      type: String,
      enum: { values: PLACEMENTS, message: 'Placement must be banner or sponsored' },
      required: [true, 'Placement is required'],
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

advertSchema.index({ placement: 1, active: 1 });
advertSchema.statics.PLACEMENTS = PLACEMENTS;

module.exports = mongoose.models.Advert || mongoose.model('Advert', advertSchema);
