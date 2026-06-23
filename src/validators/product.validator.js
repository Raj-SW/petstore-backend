const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

// Cross-field sale validation shared by create + update. Returns an error
// message string, or null if valid. `body` is the Joi-validated value object.
function saleValidationError(body) {
  if (!body.onSale) return null;
  const value = Number(body.discountValue);
  if (!value || value <= 0) return 'A discount value greater than 0 is required when a product is on sale';
  if (body.discountType === 'percent') {
    if (value < 1 || value > 100) return 'Percentage discount must be between 1 and 100';
  } else if (body.discountType === 'amount') {
    if (body.price !== undefined && !(value > 0 && value < Number(body.price))) {
      return 'Fixed sale price must be greater than 0 and less than the product price';
    }
  }
  if (body.saleStartsAt && body.saleEndsAt) {
    if (new Date(body.saleEndsAt).getTime() <= new Date(body.saleStartsAt).getTime()) {
      return 'Sale end date must be after the start date';
    }
  }
  return null;
}

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
    price: Joi.number().min(0).messages({
      'number.base': 'Price must be a number',
      'number.min': 'Price cannot be negative',
    }),
    quantity: Joi.number().integer().min(0).messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.min': 'Quantity cannot be negative',
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
    onSale:        Joi.boolean().truthy('true').falsy('false').default(false),
    discountType:  Joi.string().valid('percent', 'amount').default('percent'),
    discountValue: Joi.number().min(0).default(0),
    saleStartsAt:  Joi.date().allow('', null).optional(),
    saleEndsAt:    Joi.date().allow('', null).optional(),
    imageRefs:  Joi.string().optional(), // JSON array of pre-uploaded { url, publicId }
    sections:   Joi.string().optional(), // JSON array of { title, body, order }
    variants:   Joi.string().optional(), // JSON array of { label, price, quantity, images }
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  req.body = value;
  const saleErr = saleValidationError(value);
  if (saleErr) return next(new AppError(saleErr, 400));

  // Either variants (a non-empty JSON array) or both price and quantity must be present.
  let parsedVariants = [];
  if (value.variants) {
    try { parsedVariants = JSON.parse(value.variants); } catch { return next(new AppError('Invalid variants format', 400)); }
  }
  if (!Array.isArray(parsedVariants) || parsedVariants.length === 0) {
    if (value.price === undefined || value.quantity === undefined) {
      return next(new AppError('Either variants, or price and quantity, are required', 400));
    }
  } else {
    for (const v of parsedVariants) {
      if (!v.label || typeof v.label !== 'string'
          || v.price === undefined || Number(v.price) < 0
          || v.quantity === undefined || Number(v.quantity) < 0) {
        return next(new AppError('Each variant needs a label, price (>=0) and quantity (>=0)', 400));
      }
    }
  }
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
    onSale:        Joi.boolean().truthy('true').falsy('false'),
    discountType:  Joi.string().valid('percent', 'amount'),
    discountValue: Joi.number().min(0),
    saleStartsAt:  Joi.date().allow('', null).optional(),
    saleEndsAt:    Joi.date().allow('', null).optional(),
    keepImages: Joi.string().optional(), // JSON string of [{url,publicId}] — existing images to preserve
    imageRefs:  Joi.string().optional(), // JSON array of final ordered { url, publicId } (ImageManager)
    sections:   Joi.string().optional(), // JSON array of { title, body, order }
    variants:   Joi.string().optional(), // JSON array of { label, price, quantity, images }
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return next(new AppError(error.details[0].message, 400));
  }
  req.body = value;
  const saleErr = saleValidationError(value);
  if (saleErr) return next(new AppError(saleErr, 400));
  next();
};

module.exports = {
  validateProduct,
  validateProductUpdate,
};
