const mongoose = require('mongoose');
const Product = require('../../src/models/product.model');
const User = require('../../src/models/user.model');

describe('Product variants', () => {
  let adminId;
  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  beforeEach(async () => {
    await Product.deleteMany({});
    await User.deleteMany({});
    const admin = await User.create({
      name: 'A', email: `a-${Date.now()}@t.com`, phoneNumber: '12345678',
      address: 'x', password: 'Password123*', role: 'admin',
    });
    adminId = admin._id;
  });
  afterAll(async () => { await mongoose.connection.close(); });

  const base = (over = {}) => ({
    name: 'Dog Food', description: 'Premium kibble for dogs',
    categories: ['food'], createdBy: adminId, ...over,
  });

  it('derives product price (min) and quantity (sum) from variants', async () => {
    const p = await Product.create(base({
      variants: [
        { label: '1kg', price: 300, quantity: 5 },
        { label: '5kg', price: 1200, quantity: 8 },
      ],
    }));
    expect(p.hasVariants).toBe(true);
    expect(p.price).toBe(300);
    expect(p.quantity).toBe(13);
  });

  it('variantsView applies the sale % per variant', async () => {
    const p = await Product.create(base({
      onSale: true, discountType: 'percent', discountValue: 10,
      variants: [{ label: '5kg', price: 1000, quantity: 3 }],
    }));
    const view = p.toJSON().variantsView;
    expect(view).toHaveLength(1);
    expect(view[0].effectivePrice).toBe(900);
    expect(view[0].isOnSaleNow).toBe(true);
    expect(view[0].discountPercentLabel).toBe(10);
  });

  it('priceForVariant returns the variant effective price', async () => {
    const p = await Product.create(base({
      onSale: true, discountType: 'percent', discountValue: 50,
      variants: [{ label: '1kg', price: 200, quantity: 2 }],
    }));
    expect(p.priceForVariant(p.variants[0]._id)).toBe(100);
  });

  it('non-variant products keep working unchanged', async () => {
    const p = await Product.create(base({ price: 500, quantity: 9 }));
    expect(p.hasVariants).toBe(false);
    expect(p.effectivePrice).toBe(500);
    expect(p.toJSON().variantsView).toEqual([]);
  });
});
