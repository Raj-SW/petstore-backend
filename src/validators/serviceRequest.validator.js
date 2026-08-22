const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');
const {
  REQUEST_STATUSES, APPOINTMENT_REASONS, MOBILE_VET_REASONS, PET_TYPES,
} = require('../models/serviceRequestCommon');

// Deliberately loose — Mauritian numbers get typed with spaces, dashes and an
// optional +230. Rejecting on format here loses real leads; the admin calls back.
const phone = Joi.string().trim().min(6).max(30)
  .pattern(/^[\d\s+()-]+$/)
  .required()
  .messages({
    'string.pattern.base': 'Phone number may only contain digits, spaces, +, - and ()',
    'any.required': 'Phone number is required',
  });

const run = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) return next(new AppError(error.details.map((d) => d.message).join(', '), 400));
  req.body = value;
  return next();
};

const appointmentRequestSchema = Joi.object({
  ownerName: Joi.string().trim().min(2).max(100)
    .required(),
  phone,
  petName: Joi.string().trim().min(1).max(60)
    .required(),
  petType: Joi.string().valid(...PET_TYPES).required(),
  reason: Joi.string().valid(...APPOINTMENT_REASONS).required(),
  preferredDay: Joi.string().trim().max(40).allow(''),
  preferredTime: Joi.string().trim().max(40).allow(''),
});

const mobileVetRequestSchema = Joi.object({
  petName: Joi.string().trim().min(1).max(60)
    .required(),
  petType: Joi.string().valid(...PET_TYPES).required(),
  breed: Joi.string().trim().max(60).allow(''),
  age: Joi.string().trim().max(30).allow(''),
  weight: Joi.string().trim().max(30).allow(''),
  reason: Joi.string().valid(...MOBILE_VET_REASONS).required(),
  ownerName: Joi.string().trim().min(2).max(100)
    .required(),
  phone,
  address: Joi.string().trim().max(300).allow(''),
  // Sent as strings by multipart/form-data, so coerce rather than require numbers.
  lat: Joi.number().min(-90).max(90),
  lng: Joi.number().min(-180).max(180),
  preferredDate: Joi.date().allow('', null),
  preferredTime: Joi.string().trim().max(40).allow(''),
  additionalNotes: Joi.string().trim().max(1000).allow(''),
  isEmergency: Joi.boolean().default(false),
})
  // Either both coordinates or neither — a lone lat is meaningless to the vet.
  .and('lat', 'lng');

// Admin edits: status plus whatever detail they corrected after speaking to the
// client. Every field optional; `notes` is appended through its own endpoint.
const adminUpdateSchema = Joi.object({
  status: Joi.string().valid(...REQUEST_STATUSES),
  ownerName: Joi.string().trim().min(2).max(100),
  phone: Joi.string().trim().min(6).max(30),
  petName: Joi.string().trim().min(1).max(60),
  petType: Joi.string().valid(...PET_TYPES),
  reason: Joi.string().valid(...APPOINTMENT_REASONS, ...MOBILE_VET_REASONS),
  preferredDay: Joi.string().trim().max(40).allow(''),
  preferredTime: Joi.string().trim().max(40).allow(''),
  preferredDate: Joi.date().allow('', null),
  breed: Joi.string().trim().max(60).allow(''),
  age: Joi.string().trim().max(30).allow(''),
  weight: Joi.string().trim().max(30).allow(''),
  address: Joi.string().trim().max(300).allow(''),
  additionalNotes: Joi.string().trim().max(1000).allow(''),
  isEmergency: Joi.boolean(),
}).min(1).messages({ 'object.min': 'No fields to update' });

const noteSchema = Joi.object({
  text: Joi.string().trim().min(1).max(1000)
    .required(),
});

module.exports = {
  validateAppointmentRequest: run(appointmentRequestSchema),
  validateMobileVetRequest: run(mobileVetRequestSchema),
  validateRequestUpdate: run(adminUpdateSchema),
  validateRequestNote: run(noteSchema),
};
