const Joi = require('joi');

const PROFESSIONAL_ROLES_ENUM = ['veterinarian', 'groomer', 'trainer', 'petTaxi'];

const TIME_RE = /^([0-1]?\d|2[0-3]):[0-5]\d$/;

const availabilityDaySchema = Joi.object({
  startTime: Joi.string().pattern(TIME_RE).required().messages({
    'string.pattern.base': 'Start time must be in HH:MM format',
  }),
  endTime: Joi.string().pattern(TIME_RE).required().messages({
    'string.pattern.base': 'End time must be in HH:MM format',
  }),
  isAvailable: Joi.boolean().default(true),
});

const availabilitySchema = Joi.object({
  monday: availabilityDaySchema,
  tuesday: availabilityDaySchema,
  wednesday: availabilityDaySchema,
  thursday: availabilityDaySchema,
  friday: availabilityDaySchema,
  saturday: availabilityDaySchema,
  sunday: availabilityDaySchema,
});

const serviceSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  price: Joi.number().min(0).required(),
  duration: Joi.number().min(15).max(480).required(),
  description: Joi.string().trim().max(500).allow('').optional(),
});

const profileImageSchema = Joi.object({
  url: Joi.string().uri().allow('').optional(),
  publicId: Joi.string().allow('').optional(),
});

// Full professionalInfo — used on create (specialization + experience required).
const professionalInfoCreate = Joi.object({
  specialization: Joi.string().trim().min(2).max(100).required(),
  clinicName: Joi.string().trim().max(120).allow('').optional(),
  speciesTreated: Joi.array().items(Joi.string().trim()).optional(),
  experience: Joi.number().min(0).max(50).required(),
  qualifications: Joi.array().items(Joi.string().trim()).optional(),
  bio: Joi.string().trim().max(5000).allow('').optional(),
  services: Joi.array().items(serviceSchema).optional(),
  availability: availabilitySchema.optional(),
  profileImage: profileImageSchema.optional(),
});

// Partial professionalInfo — used on edit (every field optional).
const professionalInfoUpdate = Joi.object({
  specialization: Joi.string().trim().min(2).max(100).optional(),
  clinicName: Joi.string().trim().max(120).allow('').optional(),
  speciesTreated: Joi.array().items(Joi.string().trim()).optional(),
  experience: Joi.number().min(0).max(50).optional(),
  qualifications: Joi.array().items(Joi.string().trim()).optional(),
  bio: Joi.string().trim().max(5000).allow('').optional(),
  services: Joi.array().items(serviceSchema).optional(),
  availability: availabilitySchema.optional(),
  profileImage: profileImageSchema.optional(),
  isActive: Joi.boolean().optional(),
}).min(1);

const createProfessionalSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().trim().lowercase().required(),
  phoneNumber: Joi.string().trim().required(),
  address: Joi.string().trim().required(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).required(),
  professionalInfo: professionalInfoCreate.required(),
});

const promoteSchema = Joi.object({
  userId: Joi.string().hex().length(24).required(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).required(),
  professionalInfo: professionalInfoCreate.required(),
});

const updateProfessionalInfoSchema = Joi.object({
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).optional(),
  professionalInfo: professionalInfoUpdate.required(),
});

const listQuerySchema = Joi.object({
  search: Joi.string().trim().allow('').optional(),
  role: Joi.string().valid(...PROFESSIONAL_ROLES_ENUM).optional(),
  status: Joi.string().valid('all', 'active', 'inactive').default('all'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  sortBy: Joi.string()
    .valid('createdAt', 'name', 'professionalInfo.rating', 'professionalInfo.experience')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

module.exports = {
  PROFESSIONAL_ROLES_ENUM,
  createProfessionalSchema,
  promoteSchema,
  updateProfessionalInfoSchema,
  listQuerySchema,
};
