const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const ANIMAL_TYPES = ['dog', 'cat', 'bird', 'fish', 'rabbit', 'reptile', 'other'];
const CATEGORIES = ['nutrition', 'grooming', 'health', 'training', 'exercise', 'dental', 'behavior'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

const baseFields = {
  title: Joi.string().min(2).max(150).trim().messages({
    'string.min': 'Title must be at least 2 characters',
    'string.max': 'Title cannot exceed 150 characters',
  }),
  coverImage: Joi.alternatives().try(
    Joi.string().uri().allow(''),
    Joi.object({ url: Joi.string().uri().allow(''), publicId: Joi.string().allow('') }),
  ).messages({
    'alternatives.match': 'Cover image must be a URL or a url/publicId object',
  }),
  body: Joi.string().min(1).messages({
    'string.empty': 'Tip body is required',
  }),
  animalType: Joi.string().valid(...ANIMAL_TYPES).messages({
    'any.only': `Animal type must be one of: ${ANIMAL_TYPES.join(', ')}`,
  }),
  category: Joi.string().valid(...CATEGORIES).messages({
    'any.only': `Category must be one of: ${CATEGORIES.join(', ')}`,
  }),
  breed: Joi.string().max(80).trim().allow(''),
  difficulty: Joi.string().valid(...DIFFICULTIES),
  featured: Joi.boolean(),
  published: Joi.boolean(),
  sections: Joi.array().items(Joi.object({
    heading: Joi.string().allow('').max(150).trim(),
    body: Joi.string().allow(''),
    order: Joi.number(),
    images: Joi.array().items(Joi.object({
      url: Joi.string().allow(''),
      publicId: Joi.string().allow(''),
    })).max(8).messages({
      'array.max': 'A section can have at most 8 images',
    }),
  })).optional(),
};

const validateTip = (req, res, next) => {
  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    body: baseFields.body.required(),
    animalType: baseFields.animalType.required(),
    category: baseFields.category.required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateTipUpdate = (req, res, next) => {
  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateTip, validateTipUpdate };
