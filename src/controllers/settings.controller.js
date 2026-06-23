const StoreSettings = require('../models/storeSettings.model');
const logger = require('../utils/logger');

// GET /api/settings — public (checkout needs shipping/tax config)
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await StoreSettings.getSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/settings — admin only. Allow-listed fields, no mass-assignment.
exports.updateSettings = async (req, res, next) => {
  try {
    const ALLOWED = ['shippingFlatFee', 'freeShippingThreshold', 'taxRatePercent', 'taxInclusive'];
    const updates = {};
    for (const key of ALLOWED) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const settings = await StoreSettings.findOneAndUpdate(
      { key: 'singleton' },
      { $set: updates, $setOnInsert: { key: 'singleton' } },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );
    logger.info(`Store settings updated by admin ${req.user._id}`, { updates });
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return next(error);
  }
};
