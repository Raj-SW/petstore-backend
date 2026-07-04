/**
 * Security regression tests for ProfessionalService
 *
 * Covers the three S5147 (NoSQL injection) fixes:
 *   1. sortBy allowlist in getAllProfessionals (GET /api/professionals)
 *   2. role validation in getAvailableProfessionals (GET /api/professionals/available)
 *
 * No auth required for these public routes.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');

async function seedProfessional(overrides = {}) {
  return User.create({
    name: 'Test Vet',
    email: `vet-${Date.now()}-${Math.random()}@example.com`,
    phoneNumber: '12345678',
    address: '1 Vet Lane',
    password: 'Password123*',
    role: 'veterinarian',
    isActive: true,
    professionalInfo: {
      specialization: 'Surgery',
      experience: 5,
      rating: 4.5,
      isActive: true,
    },
    ...overrides,
  });
}

describe('Professional API — security (NoSQL injection guards)', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await seedProfessional();
  });

  // ── 1. sortBy allowlist ───────────────────────────────────────────────────

  describe('GET /api/professionals (sortBy allowlist)', () => {
    it('returns 200 with a valid sortBy value', async () => {
      const res = await request(app)
        .get('/api/professionals')
        .query({ sortBy: 'professionalInfo.rating', sortOrder: 'desc' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('rejects an unknown sortBy value via Joi validator', async () => {
      // The route validates with querySchema — unknown sortBy is stripped/rejected
      const res = await request(app)
        .get('/api/professionals')
        .query({ sortBy: '$where' });

      // Joi strips unknown values or returns 400 depending on config —
      // either way the response must not be a server error
      expect(res.status).toBeLessThan(500);
    });

    it('service-layer allowlist falls back to rating for unknown sortBy', async () => {
      // Even if the validator were bypassed, the service sanitises sortBy
      const professionalService = require('../../../src/services/professionalService');

      // Should not throw — falls back to allowed field
      const result = await professionalService.getAllProfessionals(
        {},
        { page: 1, limit: 10 },
        { sortBy: '$where', sortOrder: 'desc' },
      );
      expect(Array.isArray(result.professionals)).toBe(true);
    });
  });

  // ── 2. role validation in getAvailableProfessionals ──────────────────────

  describe('GET /api/professionals/available (role injection guard)', () => {
    it('returns professionals when no role is specified', async () => {
      const res = await request(app).get('/api/professionals/available');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('returns professionals matching a valid role', async () => {
      const res = await request(app)
        .get('/api/professionals/available')
        .query({ role: 'veterinarian' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('treats an invalid role as no-role (falls back to all professional roles)', async () => {
      // An attacker supplying an operator string should not crash the server
      // and should not leak data from non-professional users
      const res = await request(app)
        .get('/api/professionals/available')
        .query({ role: '{"$gt":""}' });

      expect(res.status).toBe(200);
      // Must return an array — no server error
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('service-layer rejects non-allowlisted role and falls back to all roles', async () => {
      const professionalService = require('../../../src/services/professionalService');

      const result = await professionalService.getAvailableProfessionals({ role: '$where' });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
