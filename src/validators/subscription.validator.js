const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const addressSchema = Joi.object({
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  zipCode: Joi.string().required(),
});

// Combined minimum interval: 7 days.
const minDaysOk = (unit, count) => (unit === 'day' ? count : count * 7) >= 7;

const validateCreateSubscription = (req, res, next) => {
  const schema = Joi.object({
    items: Joi.array().items(Joi.object({
      product: Joi.string().hex().length(24).required(),
      variantId: Joi.string().hex().length(24).optional(),
      quantity: Joi.number().integer().min(1).required(),
    })).min(1).required(),
    shippingAddress: addressSchema.required(),
    paymentMethod: Joi.string().valid('credit_card', 'paypal', 'stripe').required(),
    intervalUnit: Joi.string().valid('day', 'week').required(),
    intervalCount: Joi.number().integer().min(1).required(),
    source: Joi.string().valid('product', 'checkout').required(),
  });

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  if (!minDaysOk(value.intervalUnit, value.intervalCount)) {
    return next(new AppError('Minimum interval is 7 days', 400));
  }
  req.body = value;
  next();
};

const validateUpdateSubscription = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string().valid('active', 'paused', 'cancelled'),
    intervalUnit: Joi.string().valid('day', 'week'),
    intervalCount: Joi.number().integer().min(1),
    nextRunAt: Joi.date(),
    items: Joi.array().items(Joi.object({
      product: Joi.string().hex().length(24).required(),
      variantId: Joi.string().hex().length(24).optional(),
      quantity: Joi.number().integer().min(1).required(),
    })).min(1),
    discountPercent: Joi.number().min(0).max(100),
    action: Joi.string().valid('skip'),
  }).min(1);

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  if (value.intervalUnit && value.intervalCount && !minDaysOk(value.intervalUnit, value.intervalCount)) {
    return next(new AppError('Minimum interval is 7 days', 400));
  }
  req.body = value;
  next();
};

module.exports = { validateCreateSubscription, validateUpdateSubscription };
