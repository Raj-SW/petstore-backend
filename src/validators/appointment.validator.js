const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAppointment = (req, res, next) => {
  const schema = Joi.object({
    serviceProviderId: Joi.string().required(),
    serviceType: Joi.string().valid('vet', 'groomer').required(),
    pet: Joi.object({
      name: Joi.string().required(),
      species: Joi.string().required(),
      breed: Joi.string(),
      age: Joi.number().min(0),
    }).required(),
    date: Joi.date().min('now').required(),
    timeSlot: Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    }).required(),
    reason: Joi.string().required().min(10).max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateAppointmentStatus = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('accepted', 'rejected', 'completed', 'cancelled')
      .required(),
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