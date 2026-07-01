/**
 * Tests for Epic 7b — feedback photos {url,publicId}, mass-assignment fix, upload.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn().mockResolvedValue([{ url: 'https://c/f.jpg', publicId: 'feedback/f' }]),
  deleteMultipleFromCloudinary: (...args) => mockDelete(...args),
}));
jest.mock('../../../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Feedback = require('../../../src/models/feedback.model');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Feedback photos + admin (Epic 7b)', () => {
  let adminToken;

  beforeEach(async () => {
    await User.deleteMany({});
    await Feedback.deleteMany({});
    const admin = await User.create({
      name: 'Admin', email: `admin-${Date.now()}-${Math.random()}@x.com`,
      phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin',
    });
    adminToken = admin.generateAuthToken();
  });

  it('submitFeedback stores photos as { url, publicId }', async () => {
    const res = await request(app).post('/api/feedback')
      .field('name', 'Jane Doe').field('rating', '5').field('message', 'Great service here')
      .attach('photos', TINY_PNG, 'a.png');
    expect(res.status).toBe(201);
    const fb = await Feedback.findById(res.body.data._id);
    expect(fb.photos).toHaveLength(1);
    expect(fb.photos[0].publicId).toBe('feedback/f');
    expect(fb.photos[0].url).toBe('https://c/f.jpg');
  });

  it('updateFeedback ignores non-allow-listed fields (mass-assignment fix)', async () => {
    const fb = await Feedback.create({ name: 'Customer', rating: 4, message: 'nice product', approved: false });
    const res = await request(app).patch(`/api/feedback/${fb._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ approved: true, _id: '0123456789abcdef01234567', bogus: 1 });
    expect(res.status).toBe(200);
    expect(res.body.data.approved).toBe(true);
    expect(String(res.body.data._id)).toBe(String(fb._id)); // _id not overwritten
    expect(res.body.data.bogus).toBeUndefined();
  });

  it('updateFeedback deletes Cloudinary assets for removed photos', async () => {
    mockDelete.mockClear();
    const fb = await Feedback.create({
      name: 'Customer', rating: 4, message: 'nice product', approved: true,
      photos: [
        { url: 'https://c/p1.jpg', publicId: 'feedback/p1' },
        { url: 'https://c/p2.jpg', publicId: 'feedback/p2' },
      ],
    });
    const res = await request(app).patch(`/api/feedback/${fb._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ photos: [{ url: 'https://c/p2.jpg', publicId: 'feedback/p2' }] });
    expect(res.status).toBe(200);
    expect(res.body.data.photos).toHaveLength(1);
    expect(mockDelete).toHaveBeenCalledWith(['feedback/p1']);
  });

  it('upload-image returns { url, publicId }', async () => {
    const res = await request(app).post('/api/feedback/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, 'a.png');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ url: 'https://c/f.jpg', publicId: 'feedback/f' });
  });
});
