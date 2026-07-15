/**
 * Integration tests: admin dashboard/analytics revenue aggregation.
 *
 * `finalAmount` is a Mongoose VIRTUAL (grandTotal || totalAmount - discount);
 * virtuals do not exist inside aggregation pipelines, so `$sum: '$finalAmount'`
 * summed 0 for every order and the dashboard reported Rs 0 revenue no matter
 * how many completed orders existed. The pipelines now compute the same
 * expression aggregation-side and must handle BOTH order generations:
 * legacy docs (totalAmount only) and new checkout docs (grandTotal set).
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Order = require('../../../src/models/order.model');
const { makeUser } = require('../../helpers/factories');

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function adminToken() {
  const email = `admin-rev-${uniq()}@test.com`;
  await User.create(makeUser({ email, role: 'admin', password: 'Password123*' }));
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

const baseOrder = (userId, overrides = {}) => ({
  user: userId,
  items: [
    {
      product: new mongoose.Types.ObjectId(),
      quantity: 1,
      price: 100,
    },
  ],
  totalItems: 1,
  totalAmount: 100,
  discount: 0,
  shippingAddress: {
    street: '1 Test St', city: 'Port Louis', state: 'PL',
    country: 'Mauritius', zipCode: '11111',
  },
  paymentMethod: 'stripe',
  paymentStatus: 'completed',
  ...overrides,
});

describe('GET /api/admin/dashboard — revenue aggregation', () => {
  let token;
  let customerId;

  beforeEach(async () => {
    await Order.deleteMany({});
    token = await adminToken();
    const customer = await User.create(
      makeUser({ email: `cust-rev-${uniq()}@test.com`, role: 'customer' })
    );
    customerId = customer._id;
  });

  it('sums revenue across legacy (totalAmount) and new (grandTotal) orders', async () => {
    await Order.create([
      // Legacy generation: no grandTotal — virtual falls back to totalAmount - discount
      baseOrder(customerId, { totalAmount: 250, discount: 50 }), // → 200
      // New generation: grandTotal authoritative
      baseOrder(customerId, { totalAmount: 100, grandTotal: 115 }), // → 115
      // Pending payment must NOT count
      baseOrder(customerId, { totalAmount: 999, paymentStatus: 'pending' }),
    ]);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sales.total).toBe(315); // 200 + 115
  });

  it('reports zero cleanly when there are no completed orders', async () => {
    await Order.create([baseOrder(customerId, { paymentStatus: 'pending' })]);

    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sales.total).toBe(0);
  });

  it('sales analytics buckets use the same revenue expression', async () => {
    await Order.create([
      baseOrder(customerId, { totalAmount: 300 }), // legacy → 300
      baseOrder(customerId, { grandTotal: 200 }),  // new → 200
    ]);

    const res = await request(app)
      .get('/api/admin/analytics/sales?period=monthly')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const grandSum = res.body.data.reduce((s, bucket) => s + bucket.total, 0);
    expect(grandSum).toBe(500);
  });
});
