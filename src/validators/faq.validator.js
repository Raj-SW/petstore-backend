const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const baseFields = {
  question: Joi.string().min(2).max(300).trim(),
  answer: Joi.string().min(2).max(2000).trim(),
  order: Joi.number(),
  active: Joi.boolean(),
};

const validateFaq = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    question: baseFields.question.required(),
    answer: baseFields.answer.required(),
  });
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateFaqUpdate = (req, res, next) => {
  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });
  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateFaq, validateFaqUpdate };
