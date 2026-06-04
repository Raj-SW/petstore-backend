const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  quantity:   { type: Number, required: true },
  unitPrice:  { type: Number, required: true },
  total:      { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order',  required: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    lineItems:  [lineItemSchema],
    subtotal:   { type: Number, required: true },
    discount:   { type: Number, default: 0 },
    total:      { type: Number, required: true },
    shippingAddress: {
      street:  String,
      city:    String,
      state:   String,
      country: String,
      zipCode: String,
    },
    paymentMethod:  { type: String },
    transactionId:  { type: String },
    paidAt:         { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['issued', 'refunded'],
      default: 'issued',
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ user: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paidAt: -1 });

module.exports =
  mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
