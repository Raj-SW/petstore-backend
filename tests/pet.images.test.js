/**
 * Tests for Pet image endpoints
 * POST   /api/pets/:id/images                  — add photos (max 6)
 * DELETE /api/pets/:id/images/:publicId        — remove one
 * PATCH  /api/pets/:id/images/:publicId/primary — set cover (move to index 0)
 */

// Mock Cloudinary so no real uploads happen. Each "uploaded" file returns a
// deterministic { url, publicId } derived from a counter.
// NOTE: variable must be prefixed with "mock" (case-insensitive) so Jest
// allows it inside the jest.mock() factory (hoisting scope restriction).
let mockUploadCounter = 0;
jest.mock('../src/utils/cloudinary', () => ({
  uploadMultipleToCloudinary: jest.fn((files) =>
    Promise.resolve(files.map(() => {
      mockUploadCounter += 1;
      return { url: `http://img/${mockUploadCounter}.jpg`, publicId: `pets/p${mockUploadCounter}` };
    }))),
  deleteMultipleFromCloudinary: jest.fn(() => Promise.resolve()),
  validateImageFile: jest.fn(() => true),
}));

jest.mock('../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Pet = require('../src/models/pet.model');

const makeUser = (overrides = {}) => ({
  name: 'Pet Owner',
  email: `owner-${Date.now()}-${Math.random()}@example.com`,
  phoneNumber: '12345678',
  address: '1 Test St',
  password: 'Password123*',
  ...overrides,
});

async function signupAndLogin(userData) {
  await request(app).post('/api/auth/signup').send(userData);
  const res = await request(app).post('/api/auth/login').send({
    email: userData.email, password: userData.password,
  });
  return res.body.data.accessToken;
}

const png = () => Buffer.from('fakeimagebytes');

describe('Pet image endpoints', () => {
  let ownerToken;
  let owner;
  let otherToken;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI);
  });

  beforeEach(async () => {
    mockUploadCounter = 0;
    await User.deleteMany({});
    await Pet.deleteMany({});

    const ownerData = makeUser({ email: 'owner@test.com' });
    ownerToken = await signupAndLogin(ownerData);
    owner = await User.findOne({ email: 'owner@test.com' });

    otherToken = await signupAndLogin(makeUser({ email: 'other@test.com' }));
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  const makePet = (overrides = {}) => Pet.create({
    name: 'Rex', breed: 'Labrador', age: 3, type: 'dog',
    color: 'golden', gender: 'male', owner: owner._id, ...overrides,
  });

  describe('POST /api/pets/:id/images', () => {
    it('adds photos and returns the updated pet', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg')
        .attach('petImages', png(), 'b.jpg');
      expect(res.status).toBe(201);
      expect(res.body.data.images).toHaveLength(2);
      expect(res.body.data.images[0]).toHaveProperty('url');
      expect(res.body.data.images[0]).toHaveProperty('publicId');
    });

    it('rejects when no file is attached', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
    });

    it('rejects exceeding the 6-photo cap', async () => {
      const existing = Array.from({ length: 5 }, (_, i) => ({ url: `u${i}`, publicId: `pets/x${i}` }));
      const pet = await makePet({ images: existing });
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg')
        .attach('petImages', png(), 'b.jpg');
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at most 6/i);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet();
      const res = await request(app)
        .post(`/api/pets/${pet._id}/images`)
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('petImages', png(), 'a.jpg');
      expect(res.status).toBe(403);
    });

    it('404s for a missing pet', async () => {
      const res = await request(app)
        .post(`/api/pets/${new mongoose.Types.ObjectId()}/images`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('petImages', png(), 'a.jpg');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/pets/:id/images/:publicId', () => {
    it('removes the matching image', async () => {
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/keep' },
        { url: 'u2', publicId: 'pets/remove' },
      ] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/remove')}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.images).toHaveLength(1);
      expect(res.body.data.images[0].publicId).toBe('pets/keep');
    });

    it('404s when the publicId is not on the pet', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/keep' }] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/ghost')}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/keep' }] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/keep')}`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /api/pets/:id/images/:publicId/primary', () => {
    it('moves the chosen image to index 0', async () => {
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/a' },
        { url: 'u2', publicId: 'pets/b' },
        { url: 'u3', publicId: 'pets/c' },
      ] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/c')}/primary`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.images[0].publicId).toBe('pets/c');
      expect(res.body.data.images).toHaveLength(3);
    });

    it('404s when the publicId is not on the pet', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/a' }] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/ghost')}/primary`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });

    it('rejects a non-owner with 403', async () => {
      const pet = await makePet({ images: [{ url: 'u1', publicId: 'pets/a' }] });
      const res = await request(app)
        .patch(`/api/pets/${pet._id}/images/${encodeURIComponent('pets/a')}/primary`)
        .set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/pets/:id cleans up images', () => {
    it('calls Cloudinary delete with the pet image publicIds', async () => {
      const { deleteMultipleFromCloudinary } = require('../src/utils/cloudinary');
      deleteMultipleFromCloudinary.mockClear();
      const pet = await makePet({ images: [
        { url: 'u1', publicId: 'pets/a' },
        { url: 'u2', publicId: 'pets/b' },
      ] });
      const res = await request(app)
        .delete(`/api/pets/${pet._id}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(deleteMultipleFromCloudinary).toHaveBeenCalledWith(['pets/a', 'pets/b']);
    });
  });
});
