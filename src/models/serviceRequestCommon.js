const mongoose = require('mongoose');

// Shared between appointmentRequest and mobileVetRequest. Both are public,
// unauthenticated lead captures from the homepage hero, so they share the same
// admin lifecycle (status + running notes) even though their payloads differ.
const REQUEST_STATUSES = ['new', 'contacted', 'confirmed', 'completed', 'cancelled'];

const APPOINTMENT_REASONS = [
  'Routine Check-up',
  'Vaccination',
  'Emergency',
  'Skin Problem',
  'Digestive Problem',
  'Injury',
  'Behaviour',
  'Follow-up',
  'Other',
];

const MOBILE_VET_REASONS = [
  'Home Visit',
  'Vaccination',
  'Sick Pet',
  'Elderly Pet Care',
  'Cannot Travel to Clinic',
  'Urgent Care',
  'Other',
];

const PET_TYPES = ['Dog', 'Cat', 'Other'];

const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String, required: true, trim: true, maxlength: 1000,
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const statusField = {
  type: String,
  enum: REQUEST_STATUSES,
  default: 'new',
};

module.exports = {
  REQUEST_STATUSES,
  APPOINTMENT_REASONS,
  MOBILE_VET_REASONS,
  PET_TYPES,
  noteSchema,
  statusField,
};
