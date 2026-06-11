const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const signupSchema = Joi.object({
  name: Joi.string().required().trim(),
  email: Joi.string().email().required().trim(),
  phoneNumber: Joi.string()
    .pattern(/^[0-9]{8}$/)
    .required()
    .trim(),
  address: Joi.string().required().trim(),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must be at least 8 characters long and include one uppercase letter, one lowercase letter, one number, and one special character.',
    }),
  role: Joi.string()
    .valid('customer', 'veterinarian', 'groomer', 'trainer', 'admin')
    .default('customer'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().trim(),
  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'Password must be at least 8 characters long and include one uppercase letter, one lowercase letter, one number, and one special character.',
    }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().trim(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string().min(8).required(),
});

const validateRegister = (req, res, next) => {
  const { error } = signupSchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  return next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  return next();
};

const validateForgotPassword = (req, res, next) => {
  const { error } = forgotPasswordSchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  return next();
};

const validateResetPassword = (req, res, next) => {
  const { error } = resetPasswordSchema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  return next();
};

module.exports = {
  signupSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};
