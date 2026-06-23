const mongoose = require('mongoose');

const addressSchema = {
  street:  String,
  city:    String,
  state:   String,
  country: String,
  zipCode: String,
};

const lineItemSchema = new mongoose.Schema({
  name:              { type: String, required: true },
  variantLabel:      { type: String, default: null },
  quantity:          { type: Number, required: true },
  unitPrice:         { type: Number, required: true },
  originalUnitPrice: { type: Number, default: null },
  lineDiscount:      { type: Number, default: 0 },
  total:             { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order',  required: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    currency:   { type: String, default: 'MUR' },
    lineItems:  [lineItemSchema],
    subtotal:   { type: Number, required: true },
    discount:   { type: Number, default: 0 },
    discountCode: { type: String, default: null },
    shippingFee:  { type: Number, default: 0 },
    tax:          { type: Number, default: 0 },
    taxInclusive: { type: Boolean, default: true },
    grandTotal:   { type: Number, default: 0 },
    total:      { type: Number, required: true },
    shippingAddress: addressSchema,
    billingAddress:  addressSchema,
    customer: {
      name:  String,
      email: String,
      phone: String,
    },
    paymentMethod:  { type: String },
    transactionId:  { type: String },
    orderDate:      { type: Date },
    source:         { type: String, default: 'manual' },
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
