const Joi = require('joi');

const availabilityDaySchema = Joi.object({
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
  isAvailable: Joi.boolean().default(true),
});

const availabilitySchema = Joi.object({
  availability: Joi.object({
    monday: availabilityDaySchema.optional(),
    tuesday: availabilityDaySchema.optional(),
    wednesday: availabilityDaySchema.optional(),
    thursday: availabilityDaySchema.optional(),
    friday: availabilityDaySchema.optional(),
    saturday: availabilityDaySchema.optional(),
    sunday: availabilityDaySchema.optional(),
  }).required(),
});

const serviceSchema = Joi.object({
  name: Joi.string().required().trim().min(2).max(100),
  price: Joi.number().required().min(0),
  duration: Joi.number().required().min(15).max(480), // 15 minutes to 8 hours
  description: Joi.string().optional().trim().max(500),
});

const locationSchema = Joi.object({
  address: Joi.string().optional().trim().max(200),
  city: Joi.string().optional().trim().max(100),
  state: Joi.string().optional().trim().max(100),
  zipCode: Joi.string().optional().trim().max(20),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
  }).optional(),
});

const professionalInfoSchema = Joi.object({
  specialization: Joi.string().optional().trim().min(2).max(100),
  qualifications: Joi.array().items(Joi.string().trim()).optional(),
  experience: Joi.number().optional().min(0).max(50),
  rating: Joi.number().optional().min(0).max(5),
  reviewCount: Joi.number().optional().min(0),
  profileImage: Joi.string().uri().optional().allow(''),
  availability: Joi.object().optional(),
  isActive: Joi.boolean().optional(),
  bio: Joi.string().optional().trim().max(500),
  services: Joi.array().items(serviceSchema).optional(),
  location: locationSchema.optional(),
});

const updateProfessionalSchema = Joi.object({
  // User fields
  name: Joi.string().optional().trim().min(2).max(100),
  phoneNumber: Joi.string()
    .optional()
    .pattern(/^\+?[\d\s-]{10,}$/),
  address: Joi.string().optional().trim().max(200),

  // Professional info
  professionalInfo: professionalInfoSchema.optional(),
});

const querySchema = Joi.object({
  specialization: Joi.string().optional(),
  role: Joi.string()
    .valid('veterinarian', 'groomer', 'trainer', 'other', 'all', 'petTaxi')
    .optional(),
  rating: Joi.number().min(0).max(5).optional(),
  isActive: Joi.string().valid('true', 'false').optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      'professionalInfo.rating',
      'professionalInfo.experience',
      'professionalInfo.reviewCount',
      'name'
    )
    .default('professionalInfo.rating'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

const ratingSchema = Joi.object({
  rating: Joi.number().required().min(1).max(5).messages({
    'number.min': 'Rating must be at least 1',
    'number.max': 'Rating must be at most 5',
    'any.required': 'Rating is required',
  }),
});

module.exports = {
  updateProfessionalSchema,
  querySchema,
  availabilitySchema,
  ratingSchema,
};
