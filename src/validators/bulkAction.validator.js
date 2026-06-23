const Joi = require('joi');
const mongoose = require('mongoose');
const { AppError } = require('../middlewares/errorHandler');

const ACTIONS = ['activate', 'deactivate', 'feature', 'unfeature', 'sale', 'clearSale', 'delete'];

const validateBulkAction = (req, res, next) => {
  const schema = Joi.object({
    action: Joi.string().valid(...ACTIONS).required().messages({
      'any.only': `Action must be one of: ${ACTIONS.join(', ')}`,
      'any.required': 'Action is required',
    }),
    ids: Joi.array().items(Joi.string()).min(1).max(100).required()
      .messages({
        'array.min': 'At least one product id is required',
        'array.max': 'Cannot act on more than 100 products at once',
        'any.required': 'Product ids are required',
      }),
    options: Joi.object({
      discountType: Joi.string().valid('percent', 'amount').required(),
      discountValue: Joi.number().greater(0).required(),
      saleStartsAt: Joi.date().allow('', null).optional(),
      saleEndsAt: Joi.date().allow('', null).optional(),
    }).optional(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return next(new AppError(error.details[0].message, 400));

  if (!value.ids.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    return next(new AppError('One or more product IDs are invalid', 400));
  }

  if (value.action === 'sale') {
    if (!value.options) {
      return next(new AppError('Sale options are required for the sale action', 400));
    }
    const {
      discountType, discountValue, saleStartsAt, saleEndsAt,
    } = value.options;
    if (discountType === 'percent' && (discountValue < 1 || discountValue > 100)) {
      return next(new AppError('Percentage discount must be between 1 and 100', 400));
    }
    if (saleStartsAt && saleEndsAt
        && new Date(saleEndsAt).getTime() <= new Date(saleStartsAt).getTime()) {
      return next(new AppError('Sale end date must be after the start date', 400));
    }
  }

  req.body = value;
  return next();
};

module.exports = { validateBulkAction };
