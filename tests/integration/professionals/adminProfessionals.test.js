jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const { sendEmail } = require('../../../src/utils/email');
const { makeUser, signupAndLogin } = require('../../helpers/factories');

const proInfo = { specialization: 'Surgery', experience: 5 };

async function adminToken() {
  await User.create(makeUser({ email: 'admin-pro@test.com', role: 'admin', password: 'Password123*' }));
  const res = await request(app).post('/api/auth/login').send({ email: 'admin-pro@test.com', password: 'Password123*' });
  return res.body.data.accessToken;
}

describe('Admin professionals API', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    sendEmail.mockClear();
  });

  it('rejects non-admins', async () => {
    const { token } = await signupAndLogin();
    const res = await request(app).get('/api/admin/professionals').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('creates a professional + sends an invite, no password leak', async () => {
    const token = await adminToken();
    sendEmail.mockClear(); // ignore the login-notification email from adminToken()
    const res = await request(app)
      .post('/api/admin/professionals')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Dr New', email: 'drnew@example.com', phoneNumber: '12345678',
        address: '1 Clinic', role: 'veterinarian', professionalInfo: proInfo,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.password).toBeUndefined();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const stored = await User.findOne({ email: 'drnew@example.com' });
    expect(stored.passwordResetToken).toBeDefined();
  });

  it('promotes an existing customer', async () => {
    const token = await adminToken();
    const cust = await User.create(makeUser({ email: 'promote@test.com', role: 'customer' }));
    const res = await request(app)
      .post('/api/admin/professionals/promote')
      .set('Authorization', `Bearer ${token}`)
      .send({ userId: cust._id.toString(), role: 'groomer', professionalInfo: proInfo });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('groomer');
  });

  it('lists, toggles status, and offboards', async () => {
    const token = await adminToken();
    const pro = await User.create(makeUser({
      email: 'listpro@test.com', role: 'trainer',
      professionalInfo: { ...proInfo, isActive: true },
    }));

    const list = await request(app).get('/api/admin/professionals').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBe(1);

    const toggle = await request(app)
      .patch(`/api/admin/professionals/${pro._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(toggle.status).toBe(200);
    expect(toggle.body.data.professionalInfo.isActive).toBe(false);

    const off = await request(app)
      .delete(`/api/admin/professionals/${pro._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(off.status).toBe(200);
    expect(off.body.data.role).toBe('customer');
  });

  it('edits professionalInfo', async () => {
    const token = await adminToken();
    const pro = await User.create(makeUser({
      email: 'editpro@test.com', role: 'groomer',
      professionalInfo: { ...proInfo, isActive: true },
    }));
    const res = await request(app)
      .patch(`/api/admin/professionals/${pro._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ professionalInfo: { bio: 'Updated bio' } });
    expect(res.status).toBe(200);
    expect(res.body.data.professionalInfo.bio).toBe('Updated bio');
  });
});
