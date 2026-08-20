const { buildAppointmentMessage, buildMobileVetMessage } = require('./whatsapp');

describe('whatsapp message builders', () => {
  it('builds an appointment message with every supplied field', () => {
    const msg = buildAppointmentMessage({
      _id: 'abc123',
      ownerName: 'John Smith',
      phone: '+230 5 123 4567',
      petName: 'Bella',
      petType: 'dog',
      reason: 'vaccination',
      preferredDay: 'Monday',
      preferredTime: '5:00 PM',
    });
    expect(msg).toContain('APPOINTMENT REQUEST');
    expect(msg).toContain('John Smith');
    expect(msg).toContain('+230 5 123 4567');
    expect(msg).toContain('Bella');
    expect(msg).toContain('Monday');
    expect(msg).toContain('5:00 PM');
    expect(msg).toContain('abc123');
  });

  it('omits optional appointment lines that are missing', () => {
    const msg = buildAppointmentMessage({
      _id: 'x', ownerName: 'A', phone: '1', petName: 'B', petType: 'cat', reason: 'checkup',
    });
    expect(msg).not.toMatch(/Preferred:/);
    expect(msg).not.toMatch(/undefined|null/);
  });

  it('flags an emergency mobile vet request', () => {
    const normal = buildMobileVetMessage({ _id: '1', ownerName: 'A', phone: '1', petName: 'P', petType: 'dog', reason: 'sick' });
    const urgent = buildMobileVetMessage({ _id: '1', ownerName: 'A', phone: '1', petName: 'P', petType: 'dog', reason: 'sick', isEmergency: true });
    expect(normal).not.toMatch(/EMERGENCY/);
    expect(urgent).toMatch(/EMERGENCY/);
  });

  it('includes location, map link and photo when present', () => {
    const msg = buildMobileVetMessage({
      _id: 'm1', ownerName: 'A', phone: '1', petName: 'P', petType: 'dog', reason: 'sick',
      address: '12 Royal Road', coords: { lat: -20.16, lng: 57.5 },
      photo: { url: 'https://cdn/x.jpg' }, additionalNotes: 'gate is blue',
    });
    expect(msg).toContain('12 Royal Road');
    expect(msg).toContain('-20.16');
    expect(msg).toContain('https://cdn/x.jpg');
    expect(msg).toContain('gate is blue');
  });

  it('never emits undefined for a sparse mobile vet request', () => {
    const msg = buildMobileVetMessage({ _id: 'm2', ownerName: 'A', phone: '1', petName: 'P', petType: 'cat', reason: 'checkup' });
    expect(msg).not.toMatch(/undefined|null/);
  });
});

describe('sendWhatsApp', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    global.fetch = jest.fn();
  });
  afterAll(() => { process.env = OLD_ENV; });

  it('no-ops (without calling out) when credentials are absent', async () => {
    delete process.env.CALLMEBOT_PHONE;
    delete process.env.CALLMEBOT_APIKEY;
    const { sendWhatsApp } = require('./whatsapp');
    await expect(sendWhatsApp('hi')).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends the url-encoded text to the configured number', async () => {
    process.env.CALLMEBOT_PHONE = '23057580480';
    process.env.CALLMEBOT_APIKEY = 'key123';
    global.fetch.mockResolvedValue({ ok: true, status: 200, text: async () => 'Message queued' });
    const { sendWhatsApp } = require('./whatsapp');
    await expect(sendWhatsApp('Hello world & pets')).resolves.toBe(true);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('phone=23057580480');
    expect(url).toContain('apikey=key123');
    expect(url).toContain(encodeURIComponent('Hello world & pets'));
  });

  it('resolves false instead of throwing when the provider fails', async () => {
    process.env.CALLMEBOT_PHONE = '23057580480';
    process.env.CALLMEBOT_APIKEY = 'key123';
    global.fetch.mockRejectedValue(new Error('network down'));
    const { sendWhatsApp } = require('./whatsapp');
    await expect(sendWhatsApp('x')).resolves.toBe(false);
  });

  it('resolves false on a non-ok response', async () => {
    process.env.CALLMEBOT_PHONE = '23057580480';
    process.env.CALLMEBOT_APIKEY = 'key123';
    global.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => 'bad key' });
    const { sendWhatsApp } = require('./whatsapp');
    await expect(sendWhatsApp('x')).resolves.toBe(false);
  });
});
