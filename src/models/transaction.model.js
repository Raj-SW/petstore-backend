const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    type: {
      type: String,
      enum: ['payment', 'refund'],
      required: true,
    },
    amount:        { type: Number, required: true },
    currency:      { type: String, default: 'MUR' },
    paymentMethod: { type: String },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ order: 1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
