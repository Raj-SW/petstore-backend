const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const baseFields = {
  title: Joi.string().min(2).max(120).trim(),
  image: Joi.string().uri().allow(''),
  // Allows relative internal links like /petshop as well as absolute URLs.
  // Empty allowed at the base so hero slides (and partial updates) can omit it.
  link: Joi.string().trim().allow(''),
  placement: Joi.string().valid('banner', 'sponsored', 'hero', 'promo').messages({
    'any.only': 'Placement must be banner, sponsored, hero, or promo',
  }),
  order: Joi.number().min(0),
  active: Joi.boolean(),
};

const validateAdvert = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    // Link required (non-empty) for banner/sponsored; optional for hero & promo.
    link: Joi.string().trim().when('placement', {
      is: Joi.valid('hero', 'promo'),
      then: Joi.optional().allow(''),
      otherwise: Joi.string().trim().min(1).required().messages({
        'any.required': 'Advert link is required',
        'string.empty': 'Advert link is required',
      }),
    }),
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
