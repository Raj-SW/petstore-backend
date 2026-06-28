/**
 * Tests for PATCH /api/users/upload-avatar
 *
 * Cloudinary utilities are mocked so no real credentials are needed.
 * Multer disk-storage is also mocked to avoid writing files during tests.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── Mock Cloudinary utilities BEFORE app is loaded ──────────────────────────
jest.mock('../../src/utils/cloudinary', () => ({
  validateImageFile: jest.fn(),          // no-op by default (valid)
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([
    { url: 'https://res.cloudinary.com/test/image/upload/avatars/abc123.jpg', publicId: 'avatars/abc123' },
  ]),
  deleteMultipleFromCloudinary: jest.fn().mockResolvedValue(undefined),
}));

// ── Mock multer upload middleware to inject req.file without hitting disk ───
// We replace upload.single so that it sets req.file from the raw request
// and then calls next(), without needing a real 'uploads/' directory.
jest.mock('../../src/middlewares/upload', () => {
  const multer = require('multer');
  const mockStorage = multer.memoryStorage();
  const mockUpload = multer({ storage: mockStorage });
  return { upload: mockUpload };
});

const app = require('../../src/app');
const User = require('../../src/models/user.model');
const cloudinaryUtils = require('../../src/utils/cloudinary');

// Minimal 1×1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const makeUser = (overrides = {}) => ({
  name: 'Avatar User',
  email: `avatar-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '1 Test Lane',
  password: 'Password123*',
  role: 'customer',
  ...overrides,
});

async function registerAndLogin(agent, userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await agent.post('/api/auth/login').send({
    email: userData.email,
    password: userData.password,
  });
  return res.body.data.accessToken;
}

describe('PATCH /api/users/upload-avatar', () => {
  let agent;
  let cookie;
  let userData;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  beforeEach(async () => {
    // Reset mocks
    cloudinaryUtils.validateImageFile.mockClear();
    cloudinaryUtils.uploadMultipleToCloudinary.mockClear().mockResolvedValue([
      { url: 'https://res.cloudinary.com/test/image/upload/avatars/abc123.jpg', publicId: 'avatars/abc123' },
    ]);
    cloudinaryUtils.deleteMultipleFromCloudinary.mockClear().mockResolvedValue(undefined);

    await User.deleteMany({});

    agent = request.agent(app);
    userData = makeUser();
    cookie = await registerAndLogin(agent, userData);
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ── 401 when not authenticated ───────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .patch('/api/users/upload-avatar')
      .attach('avatar', TINY_PNG, { filename: 'test.png', contentType: 'image/png' });

    expect(res.status).toBe(401);
  });

  // ── 400 when no file is provided ─────────────────────────────────────────

  it('returns 400 when no file is uploaded', async () => {
    const res = await agent
      .patch('/api/users/upload-avatar')
      .set('Authorization', `Bearer ${cookie}`);
    // No .attach() → req.file will be undefined

    expect(res.status).toBe(400);
    expect(res.body.success).toBeFalsy();
  });

  // ── Successful upload ─────────────────────────────────────────────────────

  it('uploads avatar and returns profileImage URL', async () => {
    const res = await agent
      .patch('/api/users/upload-avatar')
      .set('Authorization', `Bearer ${cookie}`)
      .attach('avatar', TINY_PNG, { filename: 'avatar.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profileImage).toBe(
      'https://res.cloudinary.com/test/image/upload/avatars/abc123.jpg',
    );

    // Cloudinary upload was called with folder 'avatars'
    expect(cloudinaryUtils.uploadMultipleToCloudinary).toHaveBeenCalledWith(
      expect.any(Array),
      'avatars',
    );

    // User's profileImage in DB is updated
    const user = await User.findOne({ email: userData.email });
    expect(user.profileImage.url).toBe(
      'https://res.cloudinary.com/test/image/upload/avatars/abc123.jpg',
    );
    expect(user.profileImage.publicId).toBe('avatars/abc123');
  });

  // ── Old image deletion ────────────────────────────────────────────────────

  it('deletes the old Cloudinary image when one already exists', async () => {
    // Seed the user with an existing profileImage
    await User.findOneAndUpdate(
      { email: userData.email },
      { profileImage: { url: 'https://old.url/img.jpg', publicId: 'avatars/old123' } },
    );

    const res = await agent
      .patch('/api/users/upload-avatar')
      .set('Authorization', `Bearer ${cookie}`)
      .attach('avatar', TINY_PNG, { filename: 'new.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(cloudinaryUtils.deleteMultipleFromCloudinary).toHaveBeenCalledWith(['avatars/old123']);
  });
});
