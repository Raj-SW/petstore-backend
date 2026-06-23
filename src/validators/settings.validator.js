const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateSettingsUpdate = (req, res, next) => {
  const schema = Joi.object({
    shippingFlatFee: Joi.number().min(0).messages({
      'number.base': 'Shipping fee must be a number',
      'number.min': 'Shipping fee cannot be negative',
    }),
    freeShippingThreshold: Joi.number().min(0).messages({
      'number.base': 'Free-shipping threshold must be a number',
      'number.min': 'Free-shipping threshold cannot be negative',
    }),
    taxRatePercent: Joi.number().min(0).max(100).messages({
      'number.base': 'Tax rate must be a number',
      'number.min': 'Tax rate cannot be negative',
      'number.max': 'Tax rate cannot exceed 100',
    }),
    taxInclusive: Joi.boolean().truthy('true').falsy('false'),
  }).min(1);

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateSettingsUpdate };
