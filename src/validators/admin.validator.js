const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateAnalyticsPeriod = (req, res, next) => {
  const schema = Joi.object({
    period: Joi.string().valid('weekly', 'monthly', 'yearly').default('monthly'),
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateDateRange = (req, res, next) => {
  const schema = Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  });

  const { error } = schema.validate(req.query);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateAnalyticsPeriod,
  validateDateRange,
};
