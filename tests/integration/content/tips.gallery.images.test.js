/**
 * Epic 8 — tips/gallery cover image {url,publicId} + per-section images + upload.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));
const mockDelete = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/cloudinary', () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({ url: 'https://c/u.jpg', publicId: 'tips/u' }),
  deleteMultipleFromCloudinary: (...a) => mockDelete(...a),
  validateImageFile: jest.fn(),
}));
jest.mock('../../../src/middlewares/upload', () => {
  const multer = require('multer');
  return { upload: multer({ storage: multer.memoryStorage() }) };
});

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const PetCareTip = require('../../../src/models/petCareTip.model');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Tips cover + section images (Epic 8)', () => {
  let adminToken;
  let adminId;


  beforeEach(async () => {
    await User.deleteMany({}); await PetCareTip.deleteMany({});
    mockDelete.mockClear();
    const admin = await User.create({ name: 'A', email: `a-${Date.now()}-${Math.random()}@x.com`, phoneNumber: '12345678', address: 'x', password: 'Password123*', role: 'admin' });
    adminId = admin._id; adminToken = admin.generateAuthToken();
  });

  const base = { title: 'Feeding Tips', body: 'Feed your dog twice a day.', animalType: 'dog', category: 'nutrition' };

  it('upload-image returns { url, publicId }', async () => {
    const res = await request(app).post('/api/tips/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', TINY_PNG, 'u.png');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ url: 'https://c/u.jpg', publicId: 'tips/u' });
  });

  it('creates a tip with a cover image ref and per-section images', async () => {
    const res = await request(app).post('/api/tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...base,
        coverImage: { url: 'https://c/cover.jpg', publicId: 'tips/cover' },
        sections: [{ heading: 'Step 1', body: 'Measure portions', images: [{ url: 'https://c/s1.jpg', publicId: 'tips/s1' }] }],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.coverImage.publicId).toBe('tips/cover');
    expect(res.body.data.sections[0].images[0].publicId).toBe('tips/s1');
  });

  it('coerces a legacy string coverImage into { url, publicId }', async () => {
    const res = await request(app).post('/api/tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, coverImage: 'https://c/legacy.jpg' });
    expect(res.status).toBe(201);
    expect(res.body.data.coverImage.url).toBe('https://c/legacy.jpg');
  });

  it('rejects more than 8 images on a section', async () => {
    const imgs = Array.from({ length: 9 }, (_, i) => ({ url: `u${i}`, publicId: `tips/s${i}` }));
    const res = await request(app).post('/api/tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...base, sections: [{ heading: 'X', body: 'y', images: imgs }] });
    expect(res.status).toBe(400);
  });

  it('migration wraps a legacy string coverImage and is idempotent', async () => {
    const { migrateCollection, parsePublicId } = require('../../../scripts/migrate-cover-images');
    expect(parsePublicId('https://res.cloudinary.com/x/image/upload/v1/tips/abc.jpg')).toBe('tips/abc');

    const col = mongoose.connection.db.collection('petcaretips');
    await col.insertOne({ title: 'Legacy', body: 'b', animalType: 'dog', category: 'health', slug: `legacy-${Date.now()}`, coverImage: 'https://res.cloudinary.com/x/image/upload/v1/tips/legacy.jpg', createdBy: adminId });

    const first = await migrateCollection(col);
    expect(first).toBeGreaterThanOrEqual(1);
    const second = await migrateCollection(col); // idempotent — nothing left in string shape
    expect(second).toBe(0);

    const doc = await col.findOne({ title: 'Legacy' });
    expect(doc.coverImage.url).toBe('https://res.cloudinary.com/x/image/upload/v1/tips/legacy.jpg');
    expect(doc.coverImage.publicId).toBe('tips/legacy');
  });

  it('on update deletes Cloudinary assets for a swapped cover and removed section image', async () => {
    const created = await request(app).post('/api/tips')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...base,
        coverImage: { url: 'https://c/old.jpg', publicId: 'tips/old' },
        sections: [{ heading: 'S', body: 'b', images: [{ url: 'https://c/sa.jpg', publicId: 'tips/sa' }, { url: 'https://c/sb.jpg', publicId: 'tips/sb' }] }],
      });
    const id = created.body.data._id;

    const res = await request(app).patch(`/api/tips/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        coverImage: { url: 'https://c/new.jpg', publicId: 'tips/new' },
        sections: [{ heading: 'S', body: 'b', images: [{ url: 'https://c/sa.jpg', publicId: 'tips/sa' }] }],
      });
    expect(res.status).toBe(200);
    const removed = mockDelete.mock.calls.flat(2);
    expect(removed).toEqual(expect.arrayContaining(['tips/old', 'tips/sb']));
    expect(removed).not.toContain('tips/sa');
  });
});
