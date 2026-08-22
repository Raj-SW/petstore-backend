/**
 * The clinic is notified on WhatsApp when a booking comes in — and a provider
 * outage must never cost the customer their booking.
 */
jest.mock('../../../src/utils/whatsapp', () => ({
  sendWhatsApp: jest.fn().mockResolvedValue(true),
  buildAppointmentMessage: jest.requireActual('../../../src/utils/whatsapp').buildAppointmentMessage,
  buildMobileVetMessage: jest.requireActual('../../../src/utils/whatsapp').buildMobileVetMessage,
}));

const request = require('supertest');
const app = require('../../../src/app');
const AppointmentRequest = require('../../../src/models/appointmentRequest.model');
const MobileVetRequest = require('../../../src/models/mobileVetRequest.model');
const { sendWhatsApp } = require('../../../src/utils/whatsapp');

const APPOINTMENT = {
  ownerName: 'John Smith',
  phone: '+230 5 123 4567',
  petName: 'Bella',
  petType: 'Dog',
  reason: 'Vaccination',
  preferredDay: 'Monday',
  preferredTime: '5:00 PM',
};

const MOBILE_VET = {
  ownerName: 'Jane Doe',
  phone: '+230 5 987 6543',
  petName: 'Milo',
  petType: 'Cat',
  reason: 'Sick Pet',
  address: '12 Royal Road, Piton',
};

// Wait for the detached notify() promise to settle.
const flush = () => new Promise((r) => setImmediate(r));

describe('Booking notifications', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AppointmentRequest.deleteMany({});
    await MobileVetRequest.deleteMany({});
  });

  it('sends a WhatsApp message with the appointment details', async () => {
    const res = await request(app).post('/api/requests/appointments').send(APPOINTMENT);
    expect(res.status).toBe(201);
    await flush();

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    const msg = sendWhatsApp.mock.calls[0][0];
    expect(msg).toContain('APPOINTMENT REQUEST');
    expect(msg).toContain('John Smith');
    expect(msg).toContain('+230 5 123 4567');
    expect(msg).toContain('Bella');
    expect(msg).toContain('Monday');
  });

  it('sends a WhatsApp message with the mobile vet details', async () => {
    const res = await request(app).post('/api/requests/mobile-vet').send(MOBILE_VET);
    expect(res.status).toBe(201);
    await flush();

    expect(sendWhatsApp).toHaveBeenCalledTimes(1);
    const msg = sendWhatsApp.mock.calls[0][0];
    expect(msg).toContain('mobile vet request');
    expect(msg).toContain('Jane Doe');
    expect(msg).toContain('12 Royal Road, Piton');
  });

  it('marks an emergency mobile vet request in the message', async () => {
    await request(app)
      .post('/api/requests/mobile-vet')
      .send({ ...MOBILE_VET, isEmergency: true });
    await flush();
    expect(sendWhatsApp.mock.calls[0][0]).toMatch(/EMERGENCY/);
  });

  it('still records the booking when WhatsApp fails', async () => {
    sendWhatsApp.mockRejectedValueOnce(new Error('provider down'));
    const res = await request(app).post('/api/requests/appointments').send(APPOINTMENT);
    await flush();

    expect(res.status).toBe(201);
    expect(await AppointmentRequest.countDocuments()).toBe(1);
  });
});
