const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity cannot be less than 1'],
  },
  price: {
    type: Number,
    required: true,
  },
});

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [orderItemSchema],
    totalItems: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    discountCode: String,
    shippingAddress: {
      street: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      country: {
        type: String,
        required: true,
      },
      zipCode: {
        type: String,
        required: true,
      },
    },
    paymentMethod: {
      type: String,
      enum: ['credit_card', 'paypal', 'stripe'],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    paymentDetails: {
      transactionId: String,
      paymentDate: Date,
      amount: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    trackingNumber: String,
    estimatedDelivery: Date,
    notes: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for final amount after discount
orderSchema.virtual('finalAmount').get(function() {
  return this.totalAmount - this.discount;
});

// Indexes for efficient querying
orderSchema.index({ user: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ 'paymentStatus': 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema); 