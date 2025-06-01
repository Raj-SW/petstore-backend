const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateRegister = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(50),
    email: Joi.string().required().email(),
    password: Joi.string()
      .required()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
      .message(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required().email(),
    password: Joi.string().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateForgotPassword = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().required().email(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateResetPassword = (req, res, next) => {
  const schema = Joi.object({
    token: Joi.string().required(),
    password: Joi.string()
      .required()
      .min(8)
      .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
      .message(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      ),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};
