const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAppointment = (req, res, next) => {
  const schema = Joi.object({
    _id: Joi.number().required(),
    title: Joi.string().required(),
    datetimeISO: Joi.string().required(),
    description: Joi.string().allow(''),
    status: Joi.string().allow(''),
    type: Joi.string().allow(''),
    role: Joi.string().allow(''),
    location: Joi.string().allow(''),
    icon: Joi.string().uri().allow(''),
    petId: Joi.number(),
    petName: Joi.string().allow(''),
    petType: Joi.string().allow(''),
    ownerId: Joi.number(),
    ownerName: Joi.string().allow(''),
    duration: Joi.number(),
    notes: Joi.string().allow(''),
    professionalId: Joi.number(),
    professionalName: Joi.string().allow(''),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

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
