const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  _id: {
    type: Number,
    required: true,
    unique: true,
  },
  title: {
    type: String,
    required: true,
  },
  datetimeISO: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  status: {
    type: String,
  },
  type: {
    type: String,
  },
  role: {
    type: String,
  },
  location: {
    type: String,
  },
  icon: {
    type: String,
  },
  petId: {
    type: Number,
  },
  petName: {
    type: String,
  },
  petType: {
    type: String,
  },
  ownerId: {
    type: Number,
  },
  ownerName: {
    type: String,
  },
  duration: {
    type: Number,
  },
  notes: {
    type: String,
  },
  professionalId: {
    type: Number,
  },
  professionalName: {
    type: String,
  },
});

module.exports = mongoose.model('Appointment', appointmentSchema);
