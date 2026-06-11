const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const baseFields = {
  title: Joi.string().min(2).max(120).trim(),
  image: Joi.string().uri().allow(''),
  // Allows relative internal links like /petshop as well as absolute URLs
  link: Joi.string().min(1).trim().messages({
    'string.empty': 'Advert link is required',
  }),
  placement: Joi.string().valid('banner', 'sponsored').messages({
    'any.only': 'Placement must be banner or sponsored',
  }),
  active: Joi.boolean(),
};

const validateAdvert = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    link: baseFields.link.required(),
    placement: baseFields.placement.required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateAdvertUpdate = (req, res, next) => {
  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });
  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateAdvert, validateAdvertUpdate };
