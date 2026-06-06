/**
 * Tests for Auth Controller
 * POST /api/auth/signup
 * POST /api/auth/login
 * POST /api/auth/logout
 * POST /api/auth/forgot-password   (email mocked — SMTP not available in tests)
 * PATCH /api/auth/reset-password
 * POST /api/auth/refresh-token
 */

// Mock email utility BEFORE app loads so no real SMTP calls are made
jest.mock('../src/utils/email', () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const User     = require('../src/models/user.model');

const makeUser = (overrides = {}) => ({
  name: 'Test User',
  email: `user-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '123 Test St',
  password: 'Password123*',
  ...overrides,
});

async function signupAndLogin(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return res.body.data?.accessToken;
}

describe('Auth Controller', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── POST /signup ───────────────────────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    it('creates a new user and returns 201', async () => {
      const userData = makeUser();
      const res = await request(app).post('/api/auth/signup').send(userData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe(userData.email);
      expect(res.body.data.role).toBe('customer');
    });

    it('never returns the password in the response', async () => {
      const res = await request(app).post('/api/auth/signup').send(makeUser());
      expect(res.body.data.password).toBeUndefined();
    });

    it('ignores role field — always creates as customer', async () => {
      const res = await request(app).post('/api/auth/signup').send(makeUser({ role: 'admin' }));
      expect(res.status).toBe(201);
      expect(res.body.data.role).toBe('customer');
    });

    it('rejects duplicate email with 400', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);
      const res = await request(app).post('/api/auth/signup').send(userData);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it('rejects missing required fields with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send({ email: 'x@x.com' });
      expect(res.status).toBe(400);
    });

    it('rejects a weak password with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send(makeUser({ password: 'weak' }));
      expect(res.status).toBe(400);
    });

    it('rejects an invalid phone number format with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send(makeUser({ phoneNumber: '123' }));
      expect(res.status).toBe(400);
    });

    it('rejects an invalid email format with 400', async () => {
      const res = await request(app).post('/api/auth/signup').send(makeUser({ email: 'not-an-email' }));
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /login ────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns accessToken on valid credentials', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);

      const res = await request(app).post('/api/auth/login').send({
        email: userData.email,
        password: userData.password,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(typeof res.body.data.accessToken).toBe('string');
    });

    it('never returns the password in the login response', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);
      const res = await request(app).post('/api/auth/login').send({
        email: userData.email,
        password: userData.password,
      });
      expect(res.body.data.user?.password).toBeUndefined();
    });

    it('rejects wrong password with 401', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);

      const res = await request(app).post('/api/auth/login').send({
        email: userData.email,
        password: 'WrongPass99*',
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('rejects non-existent email with 401', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com',
        password: 'Password123*',
      });

      expect(res.status).toBe(401);
    });

    it('rejects login with missing fields with 400', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com' });
      expect(res.status).toBe(400);
    });
  });

  // ─── POST /logout ───────────────────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    it('returns 200 — stateless logout always succeeds', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── POST /forgot-password ──────────────────────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 and sets reset token when user exists', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: userData.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be persisted in DB
      const user = await User.findOne({ email: userData.email });
      expect(user.passwordResetToken).toBeDefined();
      expect(user.passwordResetExpires).toBeDefined();
      expect(user.passwordResetExpires.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns 404 for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@example.com' });

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /reset-password ──────────────────────────────────────────────────

  describe('PATCH /api/auth/reset-password', () => {
    it('resets password with a valid token and returns 200', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);

      // Manually seed a valid reset token
      const token = 'validresettoken123';
      await User.findOneAndUpdate(
        { email: userData.email },
        {
          passwordResetToken: token,
          passwordResetExpires: Date.now() + 10 * 60 * 1000,
        },
      );

      const res = await request(app)
        .patch('/api/auth/reset-password')
        .send({ token, password: 'NewPassword99*' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Token should be cleared
      const user = await User.findOne({ email: userData.email });
      expect(user.passwordResetToken).toBeUndefined();
      expect(user.passwordResetExpires).toBeUndefined();
    });

    it('rejects an expired reset token with 400', async () => {
      const userData = makeUser();
      await request(app).post('/api/auth/signup').send(userData);

      await User.findOneAndUpdate(
        { email: userData.email },
        {
          passwordResetToken: 'expiredtoken',
          passwordResetExpires: Date.now() - 1000, // already expired
        },
      );

      const res = await request(app)
        .patch('/api/auth/reset-password')
        .send({ token: 'expiredtoken', password: 'NewPassword99*' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it('rejects a completely wrong token with 400', async () => {
      const res = await request(app)
        .patch('/api/auth/reset-password')
        .send({ token: 'totallywrong', password: 'NewPassword99*' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /refresh-token ────────────────────────────────────────────────────
  // NOTE: refreshToken controller exists but the route is not yet registered
  // in auth.routes.js — these are todos until the route is wired up.

  describe('POST /api/auth/refresh-token', () => {
    it.todo('returns new tokens with a valid refresh token');
    it.todo('rejects an invalid refresh token with 401');
    it.todo('returns 400 when refresh token is missing');
  });
});
