const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const PRODUCT_TYPES = ['sale', 'new_product', 'price_drop', 'restock'];
const CONTENT_TYPES = ['new_tip', 'new_post'];
const ALL_TYPES = [...PRODUCT_TYPES, ...CONTENT_TYPES, 'event', 'general'];

const validateAnnouncement = (req, res, next) => {
  // Back-compat: an inline product-form notify sends productIds with no type → sale.
  if (!req.body.type && Array.isArray(req.body.productIds)) req.body.type = 'sale';

  const schema = Joi.object({
    type: Joi.string().valid(...ALL_TYPES).required().messages({
      'any.only': 'Invalid announcement type',
      'any.required': 'Announcement type is required',
    }),
    // bucket is derived server-side; never trusted from the client.
    bucket: Joi.any().strip(),
    subject: Joi.string().min(2).max(150).trim().required().messages({
      'string.min': 'Subject must be at least 2 characters',
      'string.empty': 'Subject is required',
      'any.required': 'Subject is required',
    }),
    message: Joi.string().max(1000).trim().allow(''),
    productIds: Joi.array().items(Joi.string().hex().length(24)),
    contentRef: Joi.object({
      kind: Joi.string().valid('tip', 'post'),
      id: Joi.string().hex().length(24),
    }),
    event: Joi.object({
      title: Joi.string().max(150),
      startsAt: Joi.date(),
      endsAt: Joi.date(),
      location: Joi.string().max(200).allow(''),
      description: Joi.string().max(1000).allow(''),
      link: Joi.string().uri().allow(''),
    }),
    cta: Joi.object({
      label: Joi.string().max(60),
      url: Joi.string().uri(),
    }),
    source: Joi.string().valid('inline', 'composer'),
  });

  const { error, value } = schema.validate(req.body, { stripUnknown: true });
  if (error) return next(new AppError(error.details[0].message, 400));

  // Per-type target requirements
  const t = value.type;
  if (PRODUCT_TYPES.includes(t)) {
    if (!Array.isArray(value.productIds) || value.productIds.length === 0) {
      return next(new AppError('Select at least one product', 400));
    }
  } else if (CONTENT_TYPES.includes(t)) {
    if (!value.contentRef || !value.contentRef.kind || !value.contentRef.id) {
      return next(new AppError('A tip or post must be selected', 400));
    }
  } else if (t === 'event') {
    if (!value.event || !value.event.title || !value.event.startsAt) {
      return next(new AppError('Event title and start date are required', 400));
    }
    if (value.event.endsAt && new Date(value.event.endsAt) < new Date(value.event.startsAt)) {
      return next(new AppError('Event end date must be on or after the start date', 400));
    }
  } else if (t === 'general') {
    if (!value.message && !(value.cta && value.cta.url)) {
      return next(new AppError('A general announcement needs a message or a call-to-action', 400));
    }
  }

  req.body = value;
  next();
};

module.exports = { validateAnnouncement };
