const mongoose = require('mongoose');

const petSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Pet name is required'],
      trim: true,
    },
    breed: {
      type: String,
      required: [true, 'Pet breed is required'],
      trim: true,
    },
    age: {
      type: Number,
      required: [true, 'Pet age is required'],
    },
    type: {
      type: String,
      required: [true, 'Pet type is required'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'Pet color is required'],
      trim: true,
    },
    gender: {
      type: String,
      required: [true, 'Pet gender is required'],
      enum: ['male', 'female', 'other'],
    },
    description: {
      type: String,
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Pet must belong to a user'],
    },
  },
  {
    timestamps: true,
  },
);

const Pet = mongoose.model('Pet', petSchema);

module.exports = Pet;
