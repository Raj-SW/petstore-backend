const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAddToCart = (req, res, next) => {
  const schema = Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().required().min(1),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateUpdateCartItem = (req, res, next) => {
  const schema = Joi.object({
    quantity: Joi.number().required().min(1),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateApplyDiscount = (req, res, next) => {
  const schema = Joi.object({
    discountCode: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateAddToCart,
  validateUpdateCartItem,
  validateApplyDiscount,
};
