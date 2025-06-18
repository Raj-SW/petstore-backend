const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentType: {
    type: String,
    required: true,
    enum: ['veterinarian', 'groomer', 'trainer', 'petTaxi', 'other'],
  },
  professionalName: {
    type: String,
    required: true,
  },
  professionalId: {
    type: String,
    ref: 'User',
    required: true,
  },
  dateTime: {
    type: Date,
    required: true,
  },
  petName: {
    type: String,
    required: true,
  },
  petId: {
    type: String,
    ref: 'Pet',
    required: true,
  },

  description: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 500,
  },
  address: {
    type: String,
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
  userId: {
    type: String,
    ref: 'User',
    required: true,
  },
});

// Update the updatedAt timestamp before saving
appointmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
