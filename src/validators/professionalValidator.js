const Joi = require('joi');

const availabilitySchema = Joi.object({
  day: Joi.string()
    .valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    .required()
    .messages({
      'any.only': 'Day must be a valid weekday',
      'any.required': 'Day is required',
    }),
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format',
      'any.required': 'Start time is required',
    }),
  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format',
      'any.required': 'End time is required',
    }),
});

const createProfessionalSchema = Joi.object({
  id: Joi.number().required(),
  name: Joi.string().required().trim().min(2).max(100),
  email: Joi.string().required().email().trim().lowercase(),
  phone: Joi.string()
    .required()
    .pattern(/^\+?[\d\s-]{10,}$/),
  specialization: Joi.string().required().trim().min(2).max(100),
  qualifications: Joi.array().items(Joi.string().trim()).default([]),
  experience: Joi.number().required().min(0).max(50),
  rating: Joi.number().min(0).max(5).default(0),
  reviews: Joi.number().min(0).default(0),
  image: Joi.string().uri().allow(''),
  availability: Joi.object().default({}),
  role: Joi.string().trim().allow(''),
});

const updateProfessionalSchema = createProfessionalSchema.fork(
  [
    'id',
    'name',
    'email',
    'phone',
    'specialization',
    'qualifications',
    'experience',
    'rating',
    'reviews',
    'image',
    'availability',
    'role',
  ],
  (schema) => schema.optional()
);

const querySchema = Joi.object({
  specialization: Joi.string(),
  rating: Joi.number().min(0).max(5),
  role: Joi.string(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  sortBy: Joi.string().valid('rating', 'experience', 'reviews').default('rating'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  createProfessionalSchema,
  updateProfessionalSchema,
  querySchema,
};
