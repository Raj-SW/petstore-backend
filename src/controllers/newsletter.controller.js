const Joi = require('joi');
const NewsletterSubscriber = require('../models/newsletterSubscriber.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// POST /api/newsletter — public subscribe (idempotent; reactivates if previously unsubscribed)
exports.subscribe = async (req, res, next) => {
  try {
    const { error, value } = Joi.object({
      email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email address',
        'any.required': 'Email is required',
      }),
    }).validate({ email: req.body.email });
    if (error) return next(new AppError(error.details[0].message, 400));

    const email = value.email.toLowerCase().trim();
    await NewsletterSubscriber.findOneAndUpdate(
      { email },
      { email, active: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    logger.info('Newsletter subscribe', { email });
    return res.status(201).json({ success: true, message: "You're subscribed! Thanks for joining." });
  } catch (err) {
    return next(err);
  }
};

// GET /api/newsletter/admin/all — admin list
exports.getSubscribersAdmin = async (req, res, next) => {
  try {
    const subs = await NewsletterSubscriber.find().sort('-createdAt');
    return res.status(200).json({ success: true, count: subs.length, data: subs });
  } catch (err) {
    return next(err);
  }
};
