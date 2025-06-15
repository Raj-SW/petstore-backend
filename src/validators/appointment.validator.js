const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const appointmentSchema = Joi.object({
  appointmentType: Joi.string()
    .valid('Veterinary', 'Grooming', 'Training', 'Other')
    .required()
    .messages({
      'any.only': 'Invalid appointment type',
      'any.required': 'Appointment type is required',
    }),

  professionalId: Joi.string().required().messages({
    'any.required': 'Professional ID is required',
  }),

  dateTimeISO: Joi.string().required().messages({
    'any.required': 'Appointment date and time is required',
  }),

  duration: Joi.number().min(15).max(240).required()
    .messages({
      'number.base': 'Duration must be a number',
      'number.min': 'Duration must be at least 15 minutes',
      'number.max': 'Duration cannot exceed 240 minutes',
      'any.required': 'Duration is required',
    }),

  description: Joi.string().min(10).max(500).required()
    .messages({
      'string.base': 'Description must be a string',
      'string.min': 'Description must be at least 10 characters long',
      'string.max': 'Description cannot exceed 500 characters',
      'any.required': 'Description is required',
    }),

  additionalNotes: Joi.string().max(1000).allow('').messages({
    'string.max': 'Additional notes cannot exceed 1000 characters',
  }),

  petId: Joi.string().required().messages({
    'any.required': 'Pet ID is required',
  }),
  ownerId: Joi.string().required().messages({
    'any.required': 'Owner ID is required',
  }),
});

const validateAppointment = (data) => appointmentSchema.validate(data, { abortEarly: false });

const validateAppointmentStatus = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid('accepted', 'rejected', 'completed', 'cancelled').required(),
    notes: Joi.string().max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateCancellation = (req, res, next) => {
  const schema = Joi.object({
    cancellationReason: Joi.string().required().min(10).max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateAppointment,
  validateAppointmentStatus,
  validateCancellation,
};
