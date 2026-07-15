/**
 * Integration tests: PATCH /api/appointments/:id/status must accept
 * lowercase statuses. The admin UI historically sent "confirmed" against
 * the model's uppercase enum, so every admin status change returned
 * 400 "Invalid status". The controller now normalizes case.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Appointment = require('../../../src/models/appointment.model');
const { makeUser } = require('../../helpers/factories');

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function adminToken() {
  const email = `admin-appt-${uniq()}@test.com`;
  await User.create(makeUser({ email, role: 'admin', password: 'Password123*' }));
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'Password123*' });
  return res.body.data.accessToken;
}

async function makeAppointment() {
  const vet = await User.create({
    name: 'Dr. Case Vet',
    email: `vet-case-${uniq()}@x.com`,
    phoneNumber: '12345678',
    address: 'clinic address',
    password: 'Password123*',
    role: 'veterinarian',
    professionalInfo: { specialization: 'General', experience: 5 },
  });
  const customer = await User.create(
    makeUser({ email: `cust-case-${uniq()}@x.com`, role: 'customer', password: 'Password123*' })
  );
  return Appointment.create({
    appointmentType: 'veterinarian',
    professionalName: vet.name,
    professionalId: vet._id,
    dateTime: new Date('2030-03-01T10:00:00Z'),
    petName: 'Rex',
    petId: new mongoose.Types.ObjectId(),
    description: 'Routine check for status-case test',
    address: '1 Test St',
    status: 'PENDING',
    userId: customer._id,
  });
}

describe('PATCH /api/appointments/:id/status — case-insensitive statuses', () => {
  it('accepts a lowercase status and stores it uppercase', async () => {
    const token = await adminToken();
    const appt = await makeAppointment();

    const res = await request(app)
      .patch(`/api/appointments/${appt._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    const updated = await Appointment.findById(appt._id);
    expect(updated.status).toBe('CONFIRMED');
  });

  it('still rejects unknown statuses', async () => {
    const token = await adminToken();
    const appt = await makeAppointment();

    const res = await request(app)
      .patch(`/api/appointments/${appt._id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'banana' });

    expect(res.status).toBe(400);
  });
});
