/**
 * Integration tests: public professional-appointments endpoint must not
 * leak customer PII (audit P1 #5).
 *
 * GET /api/appointments/professional/:professionalId is unauthenticated —
 * it exists so visitors can see a professional's busy slots. It must expose
 * only dateTime + status, never address/description/petName/userId.
 */
jest.mock('../../../src/utils/email', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined) }));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../../src/app');
const User = require('../../../src/models/user.model');
const Appointment = require('../../../src/models/appointment.model');

const uniq = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function makeVet() {
  return User.create({
    name: 'Dr. Test Vet',
    email: `vet-priv-${uniq()}@x.com`,
    phoneNumber: '12345678',
    address: 'clinic address',
    password: 'Password123*',
    role: 'veterinarian',
    professionalInfo: { specialization: 'General', experience: 5 },
  });
}

async function makeCustomer() {
  return User.create({
    name: 'Private Customer',
    email: `cust-priv-${uniq()}@x.com`,
    phoneNumber: '87654321',
    address: '42 Secret Lane, Curepipe',
    password: 'Password123*',
    role: 'customer',
  });
}

describe('GET /api/appointments/professional/:id — public privacy', () => {
  let vet;

  beforeEach(async () => {
    await Appointment.deleteMany({});
    vet = await makeVet();
    const customer = await makeCustomer();
    await Appointment.create({
      appointmentType: 'veterinarian',
      professionalName: vet.name,
      professionalId: vet._id,
      dateTime: new Date('2030-01-15T10:00:00Z'),
      petName: 'Rex',
      petId: new mongoose.Types.ObjectId(),
      description: 'Rex has been limping on his left leg for a week',
      address: '42 Secret Lane, Curepipe',
      status: 'CONFIRMED',
      userId: customer._id,
    });
  });

  it('is publicly reachable and returns confirmed appointments', async () => {
    const res = await request(app).get(`/api/appointments/professional/${vet._id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('exposes only dateTime and status — no PII fields', async () => {
    const res = await request(app).get(`/api/appointments/professional/${vet._id}`);
    const appt = res.body.data[0];

    expect(appt.dateTime).toBeTruthy();
    expect(appt.status).toBe('CONFIRMED');

    // PII must be absent
    expect(appt.address).toBeUndefined();
    expect(appt.description).toBeUndefined();
    expect(appt.petName).toBeUndefined();
    expect(appt.userId).toBeUndefined();
    expect(appt.professionalName).toBeUndefined();
  });

  it('does not include non-confirmed appointments', async () => {
    const customer = await makeCustomer();
    await Appointment.create({
      appointmentType: 'veterinarian',
      professionalName: vet.name,
      professionalId: vet._id,
      dateTime: new Date('2030-02-01T10:00:00Z'),
      petName: 'Milo',
      petId: new mongoose.Types.ObjectId(),
      description: 'Routine vaccination appointment for Milo',
      address: '7 Hidden St',
      status: 'PENDING',
      userId: customer._id,
    });

    const res = await request(app).get(`/api/appointments/professional/${vet._id}`);
    expect(res.body.data).toHaveLength(1); // only the CONFIRMED one
  });
});
