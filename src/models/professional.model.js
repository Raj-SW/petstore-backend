const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  specialization: {
    type: String,
    required: true,
    trim: true,
  },
  qualifications: {
    type: [String],
    default: [],
  },
  experience: {
    type: Number,
    required: true,
    min: 0,
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  image: {
    type: String,
    trim: true,
  },
  availability: {
    type: Object,
    default: {},
  },
  role: {
    type: String,
    trim: true,
  },
});

professionalSchema.index({ id: 1 }, { unique: true });
professionalSchema.index({ email: 1 }, { unique: true });

const Professional = mongoose.model('Professional', professionalSchema);

module.exports = Professional;
