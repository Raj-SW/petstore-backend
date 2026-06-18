const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAnnouncement = (req, res, next) => {
  const schema = Joi.object({
    subject: Joi.string().min(2).max(150).trim().required().messages({
      'string.min': 'Subject must be at least 2 characters',
      'string.empty': 'Subject is required',
      'any.required': 'Subject is required',
    }),
    message: Joi.string().max(1000).trim().allow(''),
    productIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required().messages({
      'array.min': 'Select at least one product',
      'any.required': 'Select at least one product',
    }),
    source: Joi.string().valid('inline', 'composer'),
  });

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateAnnouncement };
