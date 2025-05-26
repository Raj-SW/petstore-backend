const Joi = require('joi');
const { AppError } = require('../middlewares/errorHandler');

const validateProduct = (req, res, next) => {
  const schema = Joi.object({
    name: Joi.string().required().min(2).max(100),
    description: Joi.string().required().min(10),
    price: Joi.number().required().min(0),
    category: Joi.string().required(),
    stock: Joi.number().required().min(0),
    images: Joi.array().items(Joi.string()),
    specifications: Joi.object({
      weight: Joi.string(),
      ingredients: Joi.array().items(Joi.string()),
      ageGroup: Joi.string(),
      material: Joi.string(),
      size: Joi.string(),
      contents: Joi.array().items(Joi.string()),
      suitableFor: Joi.array().items(Joi.string()),
      type: Joi.string(),
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
};
