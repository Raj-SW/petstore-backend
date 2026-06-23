const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const CATEGORIES = ['event', 'community', 'award', 'announcement', 'behind_the_scenes'];

const normaliseTags = (v) =>
  (Array.isArray(v) ? v : String(v).split(','))
    .map((t) => String(t).trim())
    .filter(Boolean);

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
    'string.empty': 'Body is required',
  }),
  excerpt: Joi.string().allow('').max(300),
  category: Joi.string().valid(...CATEGORIES).messages({
    'any.only': `Category must be one of: ${CATEGORIES.join(', ')}`,
  }),
  eventDate: Joi.date().iso().messages({
    'date.base': 'Event date must be a valid date',
  }),
  location: Joi.string().allow('').max(160),
  tags: Joi.array().items(Joi.string().max(40)),
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

const validateGalleryPost = (req, res, next) => {
  if (req.body.tags !== undefined) req.body.tags = normaliseTags(req.body.tags);

  const schema = Joi.object({
    ...baseFields,
    title: baseFields.title.required(),
    body: baseFields.body.required(),
    category: baseFields.category.required(),
    eventDate: baseFields.eventDate.required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

const validateGalleryPostUpdate = (req, res, next) => {
  if (req.body.tags !== undefined) req.body.tags = normaliseTags(req.body.tags);

  const schema = Joi.object(baseFields).min(1).messages({
    'object.min': 'At least one field is required to update',
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));
  req.body = value;
  next();
};

module.exports = { validateGalleryPost, validateGalleryPostUpdate };
