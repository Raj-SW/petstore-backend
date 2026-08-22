const mongoose = require('mongoose');
const {
  MOBILE_VET_REASONS, PET_TYPES, noteSchema, statusField,
} = require('./serviceRequestCommon');

// Public home-visit request from the homepage hero (2-step form: pet, then
// where/when). Carries more clinical detail than an appointment request because
// the vet travels to the pet and needs to arrive prepared.
const mobileVetRequestSchema = new mongoose.Schema(
  {
    // Step 1 — the pet
    petName: {
      type: String, required: true, trim: true, maxlength: 60,
    },
    petType: { type: String, enum: PET_TYPES, required: true },
    breed: { type: String, trim: true, maxlength: 60 },
    age: { type: String, trim: true, maxlength: 30 },
    weight: { type: String, trim: true, maxlength: 30 },
    reason: { type: String, enum: MOBILE_VET_REASONS, required: true },
    photo: {
      url: { type: String, trim: true },
      publicId: { type: String, trim: true },
    },

    // Step 2 — where and when
    ownerName: {
      type: String, required: true, trim: true, maxlength: 100,
    },
    phone: {
      type: String, required: true, trim: true, maxlength: 30,
    },
    address: { type: String, trim: true, maxlength: 300 },
    // Filled by the browser's "Use my location" button; absent when the visitor
    // types an address instead.
    coords: {
      lat: { type: Number, min: -90, max: 90 },
      lng: { type: Number, min: -180, max: 180 },
    },
    preferredDate: { type: Date },
    preferredTime: { type: String, trim: true, maxlength: 40 },
    additionalNotes: { type: String, trim: true, maxlength: 1000 },
    isEmergency: { type: Boolean, default: false },

    status: statusField,
    notes: [noteSchema],
  },
  { timestamps: true },
);

// Emergencies first, then newest — matches how the admin list is sorted.
mobileVetRequestSchema.index({ status: 1, isEmergency: -1, createdAt: -1 });

module.exports = mongoose.models.MobileVetRequest
  || mongoose.model('MobileVetRequest', mobileVetRequestSchema);
