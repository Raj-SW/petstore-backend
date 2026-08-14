const mongoose = require('mongoose');
const {
  APPOINTMENT_REASONS, PET_TYPES, noteSchema, statusField,
} = require('./serviceRequestCommon');

// Public clinic-booking request from the homepage hero. Distinct from
// `Appointment`, which models a confirmed booking by a logged-in user against a
// specific professional and pet document — none of which exists for a visitor.
const appointmentRequestSchema = new mongoose.Schema(
  {
    ownerName: {
      type: String, required: true, trim: true, maxlength: 100,
    },
    phone: {
      type: String, required: true, trim: true, maxlength: 30,
    },
    petName: {
      type: String, required: true, trim: true, maxlength: 60,
    },
    petType: { type: String, enum: PET_TYPES, required: true },
    reason: { type: String, enum: APPOINTMENT_REASONS, required: true },
    preferredDay: { type: String, trim: true, maxlength: 40 },
    preferredTime: { type: String, trim: true, maxlength: 40 },
    status: statusField,
    notes: [noteSchema],
  },
  { timestamps: true },
);

appointmentRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.AppointmentRequest
  || mongoose.model('AppointmentRequest', appointmentRequestSchema);
