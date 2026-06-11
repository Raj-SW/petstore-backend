const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const appointmentSchema = Joi.object({
  appointmentType: Joi.string()
    .valid('veterinarian', 'groomer', 'trainer', 'petTaxi', 'other')
    .required()
    .messages({
      'any.only': 'Invalid appointment type',
      'any.required': 'Appointment type is required',
    }),

  professionalName: Joi.string().required().messages({
    'any.required': 'Professional name is required',
  }),

  professionalId: Joi.string().required().messages({
    'any.required': 'Professional ID is required',
  }),

  dateTime: Joi.date().required().messages({
    'any.required': 'Appointment date and time is required',
    'date.base': 'Invalid date format',
  }),

  petName: Joi.string().required().messages({
    'any.required': 'Pet name is required',
  }),

  petId: Joi.string().required().messages({
    'any.required': 'Pet ID is required',
  }),

  description: Joi.string().min(10).max(500).required().messages({
    'string.base': 'Description must be a string',
    'string.min': 'Description must be at least 10 characters long',
    'string.max': 'Description cannot exceed 500 characters',
    'any.required': 'Description is required',
  }),

  address: Joi.string().required().messages({
    'any.required': 'Appointment address is required',
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
