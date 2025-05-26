const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    serviceType: {
      type: String,
      enum: ['vet', 'groomer'],
      required: true,
    },
    pet: {
      name: {
        type: String,
        required: true,
      },
      species: {
        type: String,
        required: true,
      },
      breed: String,
      age: Number,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      start: {
        type: String,
        required: true,
      },
      end: {
        type: String,
        required: true,
      },
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
    },
    notes: String,
    cancellationReason: String,
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
appointmentSchema.index({ user: 1, date: 1 });
appointmentSchema.index({ serviceProvider: 1, date: 1 });
appointmentSchema.index({ status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema); 