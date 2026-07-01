/**
 * Epic 11 — StoreSettings singleton (shipping + tax config).
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const StoreSettings = require('../../../src/models/storeSettings.model');

describe('StoreSettings (Epic 11)', () => {
  let adminToken;
  let customerToken;

  beforeEach(async () => {
    await User.deleteMany({});
    await StoreSettings.deleteMany({});
    const admin = await User.create({
      name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminToken = admin.generateAuthToken();
    const cust = await User.create({
      name: 'Cust', email: `c-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*',
    });
    customerToken = cust.generateAuthToken();
  });

  it('GET /api/settings returns the singleton with sane defaults (15% inclusive)', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.taxRatePercent).toBe(15);
    expect(res.body.data.taxInclusive).toBe(true);
    expect(typeof res.body.data.shippingFlatFee).toBe('number');
    expect(typeof res.body.data.freeShippingThreshold).toBe('number');
  });

  it('admin PATCH /api/settings updates the singleton', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ shippingFlatFee: 120, freeShippingThreshold: 2000, taxRatePercent: 10, taxInclusive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.shippingFlatFee).toBe(120);
    expect(res.body.data.taxInclusive).toBe(false);

    // Persisted as a single doc
    const all = await StoreSettings.find({});
    expect(all).toHaveLength(1);
    expect(all[0].freeShippingThreshold).toBe(2000);
  });

  it('non-admin PATCH /api/settings is forbidden (403)', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ shippingFlatFee: 999 });
    expect(res.status).toBe(403);
  });
});
