const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['order', 'cancellation', 'restock', 'adjustment'],
      required: true,
    },
    // positive = added, negative = removed
    delta: {
      type: Number,
      required: true,
    },
    prevQty: {
      type: Number,
      required: true,
      // No min:0 — legacy products may have had negative quantity from test data
    },
    newQty: {
      type: Number,
      required: true,
      // No min:0 — legacy products may have had negative quantity from test data
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ type: 1 });

module.exports =
  mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema);
