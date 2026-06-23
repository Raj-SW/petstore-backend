const mongoose = require('mongoose');

// Single-document store configuration driving checkout shipping + tax.
const storeSettingsSchema = new mongoose.Schema(
  {
    // A fixed key guarantees a single settings document (upserted by getSettings).
    key: { type: String, default: 'singleton', unique: true },
    shippingFlatFee: { type: Number, default: 0, min: 0 },
    freeShippingThreshold: { type: Number, default: 0, min: 0 },
    taxRatePercent: { type: Number, default: 15, min: 0, max: 100 },
    taxInclusive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Return the singleton, creating it with defaults on first access.
storeSettingsSchema.statics.getSettings = async function getSettings() {
  return this.findOneAndUpdate(
    { key: 'singleton' },
    { $setOnInsert: { key: 'singleton' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
};

module.exports =
  mongoose.models.StoreSettings || mongoose.model('StoreSettings', storeSettingsSchema);
