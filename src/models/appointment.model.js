const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentType: {
    type: String,
    required: true,
  },
  professionalId: {
    type: String,
    ref: 'User',
    required: true,
  },
  professionalName: {
    type: String,
    ref: 'User',
    required: true,
  },
  professionalAddress: {
    type: String,
    required: true,
  },
  dateTime: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // Duration in minutes
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  additionalNotes: {
    type: String,
  },
  petId: {
    type: String,
    ref: 'Pet',
    required: true,
  },
  petName: {
    type: String,
    ref: 'Pet',
    required: true,
  },
  userId: {
    type: String,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED'],
    default: 'PENDING',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
appointmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
