const mongoose = require('mongoose');

const subscriptionItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: [1, 'Quantity cannot be less than 1'] },
}, { _id: false });

const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [subscriptionItemSchema],
      validate: { validator: (a) => a.length > 0, message: 'A subscription needs at least one item' },
    },
    shippingAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      country: { type: String, required: true },
      zipCode: { type: String, required: true },
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'paypal', 'stripe'],
      required: true,
    },
    intervalUnit: { type: String, enum: ['day', 'week'], required: true },
    intervalCount: { type: Number, required: true, min: 1 },
    discountPercent: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active' },
    nextRunAt: { type: Date, required: true },
    lastRunAt: { type: Date },
    source: { type: String, enum: ['product', 'checkout'], required: true },
    createdOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  },
  { timestamps: true }
);

subscriptionSchema.index({ user: 1 });
subscriptionSchema.index({ status: 1, nextRunAt: 1 });

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
