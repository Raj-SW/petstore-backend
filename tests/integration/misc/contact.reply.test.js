/**
 * POST /api/contact/:id/reply — admin replies to a customer message (emails them)
 */

jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Contact = require('../../../src/models/contact.model');
const { sendEmail } = require('../../../src/utils/email');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function loginAs(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({ email: userData.email, password: userData.password });
  return res.body.data.accessToken;
}

describe('Contact reply', () => {
  let adminToken;
  let customerToken;


  beforeEach(async () => {
    await User.deleteMany({});
    await Contact.deleteMany({});
    await User.create(makeUser({ email: 'admin@test.com', role: 'admin' }));
    const a = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'Password123*' });
    adminToken = a.body.data.accessToken;
    customerToken = await loginAs(makeUser());
    sendEmail.mockClear();
  });


  it('sends a reply email and marks the message replied (200)', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Do you board cats?' });
    const res = await request(app)
      .post(`/api/contact/${c._id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Yes, we board cats — happy to help!' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('replied');
    expect(res.body.data.lastReply).toBe('Yes, we board cats — happy to help!');
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe('jane@example.com');
  });

  it('400 when the reply message is empty', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Hi' });
    const res = await request(app)
      .post(`/api/contact/${c._id}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: '   ' });
    expect(res.status).toBe(400);
  });

  it('404 for a missing contact', async () => {
    const res = await request(app)
      .post(`/api/contact/${new mongoose.Types.ObjectId()}/reply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Hello' });
    expect(res.status).toBe(404);
  });

  it('rejects a non-admin (403) and unauthenticated (401)', async () => {
    const c = await Contact.create({ name: 'Jane', email: 'jane@example.com', message: 'Hi' });
    expect((await request(app).post(`/api/contact/${c._id}/reply`).send({ message: 'x' })).status).toBe(401);
    expect((await request(app).post(`/api/contact/${c._id}/reply`).set('Authorization', `Bearer ${customerToken}`).send({ message: 'x' })).status).toBe(403);
  });
});
