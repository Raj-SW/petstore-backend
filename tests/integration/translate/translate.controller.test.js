/**
 * POST /api/translate — hand-written glossary, with an optional machine provider.
 */
const request = require('supertest');
const app = require('../../../src/app');
const Translation = require('../../../src/models/translation.model');

describe('Translate Controller', () => {
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    await Translation.deleteMany({});
    global.fetch = jest.fn();
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe('glossary (the default path)', () => {
    it('answers from the glossary without touching the cache or a provider', async () => {
      const res = await request(app)
        .post('/api/translate')
        .send({ texts: ['Book Appointment'], to: 'fr' });

      expect(res.status).toBe(200);
      expect(res.body.data.translations).toEqual(['Prendre rendez-vous']);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns the English unchanged when nothing has an entry', async () => {
      // Correct-but-untranslated beats confidently-wrong French.
      const res = await request(app)
        .post('/api/translate')
        .send({ texts: ['Some copy nobody has translated'], to: 'fr' });

      expect(res.status).toBe(200);
      expect(res.body.data.translations).toEqual(['Some copy nobody has translated']);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not call a provider by default, even for unknown strings', async () => {
      await request(app).post('/api/translate').send({ texts: ['Brand new string'], to: 'fr' });
      expect(global.fetch).not.toHaveBeenCalled();
      // and nothing is written to the cache
      expect(await Translation.countDocuments({ source: 'Brand new string' })).toBe(0);
    });

    it('never translates the brand', async () => {
      const res = await request(app)
        .post('/api/translate')
        .send({ texts: ['VitalPaws', 'WhatsApp'], to: 'fr' });
      expect(res.body.data.translations).toEqual(['VitalPaws', 'WhatsApp']);
    });
  });

  describe('with a provider explicitly enabled', () => {
    beforeEach(() => { process.env.TRANSLATION_PROVIDER = 'mymemory'; });

    it('serves a cached translation without calling the provider', async () => {
      const { hashText } = require('../../../src/utils/translate');
      await Translation.create({
        hash: hashText('Totally uncached phrase'), source: 'Totally uncached phrase',
        target: 'fr', text: 'Phrase mise en cache', provider: 'seed',
      });

      const res = await request(app)
        .post('/api/translate')
        .send({ texts: ['Totally uncached phrase'], to: 'fr' });

      expect(res.body.data.translations).toEqual(['Phrase mise en cache']);
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

    it('does not cache a failed translation', async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 429, json: async () => ({}) });
      await request(app).post('/api/translate').send({ texts: ['Another new one'], to: 'fr' });
      expect(await Translation.countDocuments({ source: 'Another new one' })).toBe(0);
    });

    it('caches a fresh translation so the next call costs nothing', async () => {
      global.fetch.mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ responseData: { translatedText: 'Une phrase traduite' } }),
      });
      await request(app).post('/api/translate').send({ texts: ['An untranslated phrase'], to: 'fr' });

      const stored = await Translation.findOne({ target: 'fr', source: 'An untranslated phrase' });
      expect(stored.text).toBe('Une phrase traduite');

      global.fetch.mockClear();
      const second = await request(app)
        .post('/api/translate')
        .send({ texts: ['An untranslated phrase'], to: 'fr' });
      expect(second.body.data.translations).toEqual(['Une phrase traduite']);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('decodes the HTML entities the provider escapes its output with', async () => {
      global.fetch.mockResolvedValue({
        ok: true, status: 200,
        json: async () => ({ responseData: { translatedText: 'S&#39;inscrire ici' } }),
      });
      const res = await request(app)
        .post('/api/translate')
        .send({ texts: ['Register over here'], to: 'fr' });
      expect(res.body.data.translations).toEqual(["S'inscrire ici"]);
    });

    it('prefers the glossary over both the cache and the provider', async () => {
      const { hashText } = require('../../../src/utils/translate');
      await Translation.create({
        hash: hashText('Care'), source: 'Care',
        target: 'fr', text: 'Entretien', provider: 'mymemory',
      });

      const res = await request(app).post('/api/translate').send({ texts: ['Care'], to: 'fr' });

      // "Entretien" is servicing a machine; the glossary says "Soins".
      expect(res.body.data.translations).toEqual(['Soins']);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
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
});
