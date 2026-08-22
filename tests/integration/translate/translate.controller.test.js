/**
 * POST /api/translate — cached machine translation for the site's language toggle.
 */
const request = require('supertest');
const app = require('../../../src/app');
const Translation = require('../../../src/models/translation.model');

describe('Translate Controller', () => {
  beforeEach(async () => {
    await Translation.deleteMany({});
    global.fetch = jest.fn();
  });

  it('serves cached translations without calling the provider', async () => {
    const { hashText } = require('../../../src/utils/translate');
    await Translation.create({
      hash: hashText('Book Appointment'), source: 'Book Appointment',
      target: 'fr', text: 'Prendre rendez-vous', provider: 'seed',
    });

    const res = await request(app)
      .post('/api/translate')
      .send({ texts: ['Book Appointment'], to: 'fr' });

    expect(res.status).toBe(200);
    expect(res.body.data.translations).toEqual(['Prendre rendez-vous']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('falls back to the original text when the provider fails', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
    const res = await request(app)
      .post('/api/translate')
      .send({ texts: ['Something new'], to: 'fr' });

    expect(res.status).toBe(200);
    // Never a blank slot — the reader still sees English.
    expect(res.body.data.translations).toEqual(['Something new']);
  });

  it('caches a fresh translation so the next call costs nothing', async () => {
    global.fetch.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ responseData: { translatedText: 'Nos services' } }),
    });
    await request(app).post('/api/translate').send({ texts: ['Our services'], to: 'fr' });

    const stored = await Translation.findOne({ target: 'fr', source: 'Our services' });
    expect(stored.text).toBe('Nos services');

    global.fetch.mockClear();
    const second = await request(app).post('/api/translate').send({ texts: ['Our services'], to: 'fr' });
    expect(second.body.data.translations).toEqual(['Nos services']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a non-array payload and an unsupported language', async () => {
    expect((await request(app).post('/api/translate').send({ texts: 'nope' })).status).toBe(400);
    expect((await request(app).post('/api/translate').send({ texts: ['hi'], to: 'de' })).status).toBe(400);
  });

  it('rejects an oversized batch rather than hammering the provider', async () => {
    const texts = Array.from({ length: 201 }, (_, i) => `s${i}`);
    const res = await request(app).post('/api/translate').send({ texts });
    expect(res.status).toBe(400);
  });
});
