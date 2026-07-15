/**
 * Integration tests: email verification (audit P1 #12).
 *
 * The controller previously read req.params.token on a route with no
 * :token segment, so the lookup was always { emailVerificationToken:
 * undefined } and verification could never succeed. Both the emailed-link
 * form (PATCH /verify-email/:token) and the body form must now work.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeUnverifiedUser(token) {
  return User.create({
    name: 'Unverified User',
    email: `verify-${uniq()}@x.com`,
    phoneNumber: '12345678',
    address: '1 Test St',
    password: 'Password123*',
    role: 'customer',
    isEmailVerified: false,
    emailVerificationToken: token,
    emailVerificationExpires: Date.now() + 60 * 60 * 1000, // +1h
  });
}

describe('PATCH /api/auth/verify-email — token handling', () => {
  it('verifies via the emailed-link form (/verify-email/:token)', async () => {
    const token = `tok-${uniq()}`;
    const user = await makeUnverifiedUser(token);

    const res = await request(app).patch(`/api/auth/verify-email/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const fresh = await User.findById(user._id);
    expect(fresh.isEmailVerified).toBe(true);
    expect(fresh.emailVerificationToken).toBeUndefined();
  });

  it('verifies via the body form (PATCH /verify-email with { token })', async () => {
    const token = `tok-${uniq()}`;
    const user = await makeUnverifiedUser(token);

    const res = await request(app)
      .patch('/api/auth/verify-email')
      .send({ token });

    expect(res.status).toBe(200);
    const fresh = await User.findById(user._id);
    expect(fresh.isEmailVerified).toBe(true);
  });

  it('400s with a clear message when no token is supplied', async () => {
    const res = await request(app).patch('/api/auth/verify-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/token is required/i);
  });

  it('400s on an unknown or expired token', async () => {
    const res = await request(app).patch('/api/auth/verify-email/definitely-not-a-token');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid or expired/i);
  });

  it('rejects an expired token even if it matches', async () => {
    const token = `tok-${uniq()}`;
    const user = await makeUnverifiedUser(token);
    user.emailVerificationExpires = Date.now() - 1000; // already expired
    await user.save();

    const res = await request(app).patch(`/api/auth/verify-email/${token}`);
    expect(res.status).toBe(400);

    const fresh = await User.findById(user._id);
    expect(fresh.isEmailVerified).toBe(false);
  });
});
