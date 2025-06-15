const { createError } = require('./errorHandler');

/**
 * Middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate ('body', 'query', 'params')
 */
const validateRequest = (schema, property = 'body') => (req, res, next) => {
  const { error } = schema.validate(req[property], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (!error) {
    next();
  } else {
    const { details } = error;
    const message = details.map((i) => i.message).join(', ');
    next(createError(400, message));
  }
};

module.exports = { validateRequest };
