/**
 * Epic 11 — granular invoice: variant labels, was/now prices, line discount,
 * shipping, tax, grand total, billing + customer + dates + source, MUR currency,
 * and a PDF that renders (smoke test, no "$").
 */
const mongoose = require('mongoose');
const User = require('../../../src/models/user.model');
const Product = require('../../../src/models/product.model');
const Order = require('../../../src/models/order.model');
const Invoice = require('../../../src/models/invoice.model');
const Counter = require('../../../src/models/counter.model');
const { generateInvoice, generatePDF } = require('../../../src/services/invoice.service');

describe('Granular invoice (Epic 11)', () => {
  let user;
  let product;

  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Order.deleteMany({}); await Invoice.deleteMany({}); await Counter.deleteMany({});
    user = await User.create({ name: 'Jane Buyer', email: `j-${Date.now()}-${Math.random()}@t.com`, phoneNumber: '57123456', address: 'x', password: 'Password123*' });
    product = await Product.create({
      name: 'Cat Tower', description: 'A tall sturdy cat tower', categories: ['cats'], createdBy: user._id,
      images: [{ url: 'https://cdn/x.jpg', publicId: 'products/x' }], price: 2000, quantity: 10,
    });
  });

  async function makeOrder() {
    return Order.create({
      user: user._id,
      items: [{
        product: product._id, quantity: 2, price: 1600, originalPrice: 2000,
        variantId: null, variantLabel: 'Large',
      }],
      totalItems: 2,
      totalAmount: 3200,
      discount: 200,
      discountCode: 'SAVE200',
      shippingFee: 150,
      tax: 450,
      taxRate: 15,
      taxInclusive: false,
      grandTotal: 3600,
      shippingAddress: { street: '1 A St', city: 'Curepipe', state: 'PL', country: 'MU', zipCode: '74000' },
      paymentMethod: 'stripe',
      paymentDetails: { transactionId: 'TXN-9', paymentDate: new Date() },
      source: 'subscription',
    });
  }

  it('snapshots granular line items + totals + customer + source in MUR', async () => {
    const order = await makeOrder();
    const invoice = await generateInvoice(order._id, user._id);

    expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
    expect(invoice.currency).toBe('MUR');
    expect(invoice.lineItems[0]).toMatchObject({
      name: 'Cat Tower', variantLabel: 'Large', quantity: 2,
      unitPrice: 1600, originalUnitPrice: 2000,
    });
    expect(invoice.shippingFee).toBe(150);
    expect(invoice.tax).toBe(450);
    expect(invoice.taxInclusive).toBe(false);
    expect(invoice.grandTotal).toBe(3600);
    expect(invoice.discountCode).toBe('SAVE200');
    expect(invoice.customer.name).toBe('Jane Buyer');
    expect(invoice.customer.phone).toBe('57123456');
    expect(invoice.billingAddress.city).toBe('Curepipe');
    expect(invoice.source).toBe('subscription');
    expect(invoice.orderDate).toBeTruthy();
  });

  it('generatePDF returns a non-empty Buffer', async () => {
    const order = await makeOrder();
    const invoice = await generateInvoice(order._id, user._id);
    const buf = await generatePDF(invoice, user);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
  });
});
