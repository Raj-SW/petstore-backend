const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateFeedback = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(80).trim().required().messages({
      'string.min': 'Name must be at least 2 characters',
      'any.required': 'Name is required',
    }),
    role: Joi.string().max(80).trim().allow(''),
    rating: Joi.number().min(1).max(5).required().messages({
      'number.base': 'Rating is required',
      'number.min': 'Rating must be between 1 and 5',
      'number.max': 'Rating must be between 1 and 5',
    }),
    message: Joi.string().min(5).max(1000).trim().required().messages({
      'string.min': 'Message must be at least 5 characters',
      'any.required': 'Message is required',
    }),
  });

  // Validate body fields only; uploaded photos are handled in the controller.
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateFeedback };
