jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const professionalService = require('../../../src/services/professionalService');
const User = require('../../../src/models/user.model');

const proInfo = { specialization: 'Surgery', experience: 5 };

async function makePro(overrides = {}) {
  return User.create({
    name: 'Vet A',
    email: `vet-${Date.now()}-${Math.random()}@example.com`,
    phoneNumber: '12345678',
    address: '1 Vet Lane',
    password: 'Password123*',
    role: 'veterinarian',
    isActive: true,
    professionalInfo: { ...proInfo, isActive: true },
    ...overrides,
  });
}

async function makeCustomer(overrides = {}) {
  return User.create({
    name: 'Cust',
    email: `cust-${Date.now()}-${Math.random()}@example.com`,
    phoneNumber: '12345678',
    address: '2 Home Rd',
    password: 'Password123*',
    role: 'customer',
    ...overrides,
  });
}

describe('professionalService admin methods', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('adminListProfessionals', () => {
    it('includes petTaxi and strips sensitive fields', async () => {
      await makePro({ role: 'petTaxi', professionalInfo: { ...proInfo, isActive: true } });
      const res = await professionalService.adminListProfessionals({}, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0]).not.toHaveProperty('password');
      expect(res.professionals[0]).not.toHaveProperty('passwordResetToken');
    });

    it('filters by status=inactive', async () => {
      await makePro({ professionalInfo: { ...proInfo, isActive: true } });
      await makePro({ professionalInfo: { ...proInfo, isActive: false } });
      const res = await professionalService.adminListProfessionals({ status: 'inactive' }, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0].professionalInfo.isActive).toBe(false);
    });

    it('searches by name/email/specialization', async () => {
      await makePro({ name: 'Findme Vet' });
      await makePro({ name: 'Other Vet' });
      const res = await professionalService.adminListProfessionals({ search: 'Findme' }, {}, {});
      expect(res.professionals).toHaveLength(1);
      expect(res.professionals[0].name).toBe('Findme Vet');
    });
  });

  describe('createProfessionalAccount', () => {
    it('creates a hashed-password user with a reset token', async () => {
      const { user, rawToken } = await professionalService.createProfessionalAccount({
        name: 'New Vet',
        email: 'newvet@example.com',
        phoneNumber: '12345678',
        address: '3 Clinic St',
        role: 'veterinarian',
        professionalInfo: proInfo,
      });
      expect(rawToken).toHaveLength(64);
      const stored = await User.findById(user._id).select('+password');
      expect(stored.password).not.toBe(rawToken);
      expect(stored.passwordResetToken).toBe(rawToken);
      expect(stored.role).toBe('veterinarian');
    });

    it('rejects a duplicate email', async () => {
      await makePro({ email: 'dupe@example.com' });
      await expect(
        professionalService.createProfessionalAccount({
          name: 'X', email: 'dupe@example.com', phoneNumber: '12345678',
          address: 'y', role: 'groomer', professionalInfo: proInfo,
        })
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('promoteUserToProfessional', () => {
    it('promotes a customer', async () => {
      const c = await makeCustomer();
      const updated = await professionalService.promoteUserToProfessional(c._id.toString(), {
        role: 'groomer',
        professionalInfo: proInfo,
      });
      expect(updated.role).toBe('groomer');
      expect(updated.professionalInfo.specialization).toBe('Surgery');
    });

    it('rejects promoting an existing professional', async () => {
      const p = await makePro();
      await expect(
        professionalService.promoteUserToProfessional(p._id.toString(), {
          role: 'groomer', professionalInfo: proInfo,
        })
      ).rejects.toThrow('already a professional or admin');
    });
  });

  describe('offboardProfessional', () => {
    it('demotes to customer and deactivates', async () => {
      const p = await makePro();
      const updated = await professionalService.offboardProfessional(p._id.toString());
      expect(updated.role).toBe('customer');
      expect(updated.professionalInfo.isActive).toBe(false);
    });
  });

  describe('public getAllProfessionals hides deactivated', () => {
    it('excludes professionalInfo.isActive:false', async () => {
      await makePro({ professionalInfo: { ...proInfo, isActive: false } });
      const res = await professionalService.getAllProfessionals({}, {}, {});
      expect(res.professionals).toHaveLength(0);
    });
  });
});
