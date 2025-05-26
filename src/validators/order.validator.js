const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateCreateOrder = (req, res, next) => {
  const schema = Joi.object({
    shippingAddress: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      country: Joi.string().required(),
      zipCode: Joi.string().required(),
    }).required(),
    paymentMethod: Joi.string()
      .valid('credit_card', 'paypal', 'stripe')
      .required(),
    notes: Joi.string().max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateUpdateOrderStatus = (req, res, next) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('processing', 'shipped', 'delivered', 'cancelled')
      .required(),
    trackingNumber: Joi.string().when('status', {
      is: 'shipped',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    estimatedDelivery: Joi.date().when('status', {
      is: 'shipped',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    notes: Joi.string().max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validatePaymentStatus = (req, res, next) => {
  const schema = Joi.object({
    paymentStatus: Joi.string()
      .valid('completed', 'failed', 'refunded')
      .required(),
    transactionId: Joi.string().when('paymentStatus', {
      is: 'completed',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
    paymentDate: Joi.date().when('paymentStatus', {
      is: 'completed',
      then: Joi.required(),
      otherwise: Joi.optional(),
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validatePaymentStatus,
}; 