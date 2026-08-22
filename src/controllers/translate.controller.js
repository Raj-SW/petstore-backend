const Translation = require('../models/translation.model');
const { translateTexts } = require('../utils/translate');
const { AppError } = require('../middlewares/errorHandler');

const MAX_TEXTS = 200;
const SUPPORTED = ['fr', 'en'];

// POST /api/translate — public. { texts: string[], to: 'fr' }
exports.translate = async (req, res, next) => {
  try {
    const { texts, to = 'fr', from = 'en' } = req.body || {};
    if (!Array.isArray(texts)) {
      return next(new AppError('texts must be an array of strings', 400));
    }
    if (texts.length > MAX_TEXTS) {
      return next(new AppError(`Send at most ${MAX_TEXTS} strings per request`, 400));
    }
    if (!SUPPORTED.includes(to)) {
      return next(new AppError(`Unsupported target language: ${to}`, 400));
    }
    const translations = await translateTexts(Translation, texts, { from, to });
    return res.status(200).json({ success: true, data: { translations } });
  } catch (error) {
    return next(error);
  }
};
