const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateProduct = (req, res, next) => {
  // multipart/form-data sends a single appended value as a string, not an array.
  // Normalise before Joi sees the body.
  ['categories', 'colors', 'genders'].forEach((field) => {
    if (req.body[field] !== undefined && !Array.isArray(req.body[field])) {
      req.body[field] = [req.body[field]];
    }
  });

  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100).trim().messages({
      'string.base': 'Product name must be a string',
      'string.empty': 'Product name is required',
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 100 characters',
      'any.required': 'Product name is required',
    }),
    description: Joi.string().required().min(10).messages({
      'string.base': 'Description must be a string',
      'string.empty': 'Product description is required',
      'string.min': 'Description must be at least 10 characters',
      'any.required': 'Product description is required',
    }),
    price: Joi.number().required().min(0).messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price cannot be negative',
      'any.required': 'Product price is required',
    }),
    quantity: Joi.number().required().integer().min(0).messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
      'any.required': 'Quantity in stock is required',
    }),
    categories: Joi.array().items(Joi.string().trim()).min(1).required().messages({
      'array.base': 'Categories must be an array',
      'array.min': 'At least one category is required',
      'any.required': 'Categories are required',
    }),
    colors: Joi.array().items(Joi.string().trim()).default([]).messages({
      'array.base': 'Colors must be an array',
    }),
    genders: Joi.array()
      .items(Joi.string().valid('Male', 'Female', 'Unisex'))
      .default([])
      .messages({
        'array.base': 'Genders must be an array',
        'any.only': 'Gender must be one of: Male, Female, Unisex',
      }),
    isActive:   Joi.boolean().truthy('true').falsy('false').default(true),
    isFeatured: Joi.boolean().truthy('true').falsy('false').default(false),
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  req.body = value;
  next();
};

const validateProductUpdate = (req, res, next) => {
  // Same normalisation as create: single-category submissions arrive as a string
  ['categories', 'colors', 'genders'].forEach((field) => {
    if (req.body[field] !== undefined && !Array.isArray(req.body[field])) {
      req.body[field] = [req.body[field]];
    }
  });

  const schema = Joi.object({
    name: Joi.string().min(2).max(100).trim().messages({
      'string.base': 'Product name must be a string',
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 100 characters',
    }),
    description: Joi.string().min(10).messages({
      'string.base': 'Description must be a string',
      'string.min': 'Description must be at least 10 characters',
    }),
    price: Joi.number().min(0).messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price cannot be negative',
    }),
    quantity: Joi.number().integer().min(0).messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
    }),
    categories: Joi.array().items(Joi.string().trim()).min(1).messages({
      'array.base': 'Categories must be an array',
      'array.min': 'At least one category is required',
    }),
    colors: Joi.array().items(Joi.string().trim()).messages({
      'array.base': 'Colors must be an array',
    }),
    genders: Joi.array().items(Joi.string().valid('Male', 'Female', 'Unisex')).messages({
      'array.base': 'Genders must be an array',
      'any.only': 'Gender must be one of: Male, Female, Unisex',
    }),
    isActive:   Joi.boolean().truthy('true').falsy('false'),
    isFeatured: Joi.boolean().truthy('true').falsy('false'),
    keepImages: Joi.string().optional(), // JSON string of [{url,publicId}] — existing images to preserve
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  req.body = value;
  next();
};

module.exports = {
  validateProduct,
  validateProductUpdate,
};
