const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateUpdateProfile = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50),
    email: Joi.string().email(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateChangePassword = (req, res, next) => {
  const schema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string()
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
  validateUpdateProfile,
  validateChangePassword,
};
