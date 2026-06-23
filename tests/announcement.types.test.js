/**
 * Epic 9b — typed announcements (sale / event / general / content), server-derived
 * bucket, bucket-aware recipient filtering + unsubscribe.
 */
jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Product = require('../src/models/product.model');
const Announcement = require('../src/models/announcement.model');
const { sendEmail } = require('../src/utils/email');
const { makeUnsubscribeToken } = require('../src/utils/unsubscribeToken');

describe('Typed announcements (Epic 9b)', () => {
  let adminToken;
  let adminId;
  let product;

  beforeAll(async () => { await mongoose.connect(process.env.MONGODB_URI); });
  afterAll(async () => { await mongoose.disconnect(); });

  beforeEach(async () => {
    await User.deleteMany({}); await Product.deleteMany({}); await Announcement.deleteMany({});
    sendEmail.mockClear();
    const admin = await User.create({ name: 'Admin', email: `a-${Date.now()}-${Math.random()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin' });
    adminId = admin._id; adminToken = admin.generateAuthToken();
    product = await Product.create({ name: 'Leash', description: 'A strong leash for dogs', price: 500, quantity: 10, categories: ['dogs'], images: [{ url: 'u', publicId: 'p' }], createdBy: adminId });
  });

  const post = (body) => request(app).post('/api/announcements').set('Authorization', `Bearer ${adminToken}`).send(body);

  it('creates a sale announcement (promotions bucket) and persists to the announcements collection', async () => {
    await User.create({ name: 'P', email: `p-${Date.now()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'customer' });
    const res = await post({ type: 'sale', subject: 'Big Sale', productIds: [product._id.toString()], source: 'composer' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('sale');
    expect(res.body.data.bucket).toBe('promotions');
    const saved = await Announcement.findById(res.body.data._id);
    expect(saved).toBeTruthy();
  });

  it('derives bucket server-side and ignores a client-supplied bucket', async () => {
    const res = await post({ type: 'event', subject: 'Adoption Day', bucket: 'promotions', event: { title: 'Adoption Day', startsAt: '2026-07-01T10:00:00Z' } });
    expect(res.status).toBe(201);
    expect(res.body.data.bucket).toBe('news'); // event → news, not the client's 'promotions'
  });

  it('filters recipients by the derived bucket preference', async () => {
    await User.create({ name: 'NewsOff', email: `n-${Date.now()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'customer', emailPreferences: { news: false } });
    await User.create({ name: 'NewsOn', email: `y-${Date.now()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'customer' });
    const res = await post({ type: 'general', subject: 'Hello', message: 'Some news', cta: { label: 'Visit', url: 'https://x/y' } });
    expect(res.status).toBe(201);
    // Only the news-opted-in customer is emailed (admin is not role customer)
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('400s a product type with no products', async () => {
    const res = await post({ type: 'sale', subject: 'Empty', productIds: [] });
    expect(res.status).toBe(400);
  });

  it('400s an event with no start date', async () => {
    const res = await post({ type: 'event', subject: 'No date', event: { title: 'X' } });
    expect(res.status).toBe(400);
  });

  it('400s a general announcement with neither message nor cta', async () => {
    const res = await post({ type: 'general', subject: 'Nothing' });
    expect(res.status).toBe(400);
  });

  it('defaults an announcement with productIds but no type to sale (inline back-compat)', async () => {
    const res = await post({ subject: 'Inline sale', productIds: [product._id.toString()], source: 'inline' });
    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('sale');
    expect(res.body.data.source).toBe('inline');
  });

  it('unsubscribe with a news-bucket token flips only emailPreferences.news', async () => {
    const u = await User.create({ name: 'U', email: `u-${Date.now()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'customer' });
    const token = makeUnsubscribeToken(u._id, 'news');
    const res = await request(app).get(`/api/announcements/unsubscribe?token=${token}`);
    expect(res.status).toBe(200);
    const fresh = await User.findById(u._id);
    expect(fresh.emailPreferences.news).toBe(false);
    expect(fresh.emailPreferences.sales).not.toBe(false); // promotions untouched
  });
});
