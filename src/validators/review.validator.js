const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateReview = (req, res, next) => {
  const schema = Joi.object({
    rating: Joi.number().required().min(1).max(5),
    comment: Joi.string().required().min(10).max(500),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateReview,
};
