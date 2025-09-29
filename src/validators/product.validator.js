const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateProduct = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100).trim().messages({
      'string.base': 'Product name must be a string',
      'string.empty': 'Product name is required',
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 100 characters',
      'any.required': 'Product name is required',
    }),
    description: Joi.string().required().min(10).trim().messages({
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
    colors: Joi.array().items(Joi.string().trim()).default([]).messages({
      'array.base': 'Colors must be an array',
    }),
    quantity: Joi.number().required().integer().min(0).messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
      'any.required': 'Quantity in stock is required',
    }),
    genders: Joi.array()
      .items(Joi.string().valid('Male', 'Female', 'Unisex'))
      .default([])
      .messages({
        'array.base': 'Genders must be an array',
        'any.only': 'Gender must be one of: Male, Female, Unisex',
      }),
    categories: Joi.array().items(Joi.string().trim()).min(1).required().messages({
      'array.base': 'Categories must be an array',
      'array.min': 'At least one category is required',
      'any.required': 'Categories are required',
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

const validateProductUpdate = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).trim().messages({
      'string.base': 'Product name must be a string',
      'string.min': 'Product name must be at least 2 characters',
      'string.max': 'Product name cannot exceed 100 characters',
    }),
    description: Joi.string().min(10).trim().messages({
      'string.base': 'Description must be a string',
      'string.min': 'Description must be at least 10 characters',
    }),
    price: Joi.number().min(0).messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price cannot be negative',
    }),
    colors: Joi.array().items(Joi.string().trim()).messages({
      'array.base': 'Colors must be an array',
    }),
    quantity: Joi.number().integer().min(0).messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
    }),
    genders: Joi.array().items(Joi.string().valid('Male', 'Female', 'Unisex')).messages({
      'array.base': 'Genders must be an array',
      'any.only': 'Gender must be one of: Male, Female, Unisex',
    }),
    categories: Joi.array().items(Joi.string().trim()).min(1).messages({
      'array.base': 'Categories must be an array',
      'array.min': 'At least one category is required',
    }),
    imagesChanged: Joi.boolean().default(false).messages({
      'boolean.base': 'imagesChanged must be a boolean',
    }),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  next();
};

module.exports = {
  validateProduct,
  validateProductUpdate,
};
