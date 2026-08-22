const { chunkTexts, hashText, buildMyMemoryUrl, parseMyMemory } = require('./translate');

describe('translate helpers', () => {
  it('hashes source text stably and distinctly', () => {
    expect(hashText('Book Appointment')).toBe(hashText('Book Appointment'));
    expect(hashText('Book Appointment')).not.toBe(hashText('Book appointment'));
    expect(hashText('a')).toHaveLength(40);
  });

  it('groups texts into batches under the provider character limit', () => {
    const texts = ['a'.repeat(300), 'b'.repeat(300), 'c'.repeat(300)];
    const batches = chunkTexts(texts, 700);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(texts);
  });

  it('never drops a text even when one exceeds the limit on its own', () => {
    const huge = 'x'.repeat(5000);
    const batches = chunkTexts(['short', huge, 'also short'], 500);
    expect(batches.flat()).toEqual(['short', huge, 'also short']);
  });

  it('builds a MyMemory url with the language pair and encoded text', () => {
    const url = buildMyMemoryUrl('Hello & goodbye', 'en', 'fr');
    expect(url).toContain('langpair=en%7Cfr');
    expect(url).toContain(encodeURIComponent('Hello & goodbye'));
  });

  it('reads the translated text out of a MyMemory response', () => {
    expect(parseMyMemory({ responseData: { translatedText: 'Bonjour' } })).toBe('Bonjour');
  });

  it('returns null for a MyMemory error payload rather than a bogus string', () => {
    expect(parseMyMemory({ responseStatus: 403, responseData: null })).toBeNull();
    expect(parseMyMemory({})).toBeNull();
    // MyMemory signals quota problems inside the text field
    expect(parseMyMemory({ responseData: { translatedText: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' } })).toBeNull();
  });
});

describe('decodeEntities', () => {
  const { decodeEntities } = require('./translate');

  it('decodes the numeric entities MyMemory returns', () => {
    // Observed live: the footer rendered a literal "S'abonner&#10;".
    expect(decodeEntities('S&#39;abonner&#10;')).toBe("S'abonner\n");
  });

  it('decodes named entities', () => {
    expect(decodeEntities('Peau &amp; pelage')).toBe('Peau & pelage');
    expect(decodeEntities('&quot;Bonjour&quot;')).toBe('"Bonjour"');
  });

  it('does not double-decode an escaped ampersand into a real newline', () => {
    expect(decodeEntities('&amp;#10;')).toBe('&#10;');
  });

  it('leaves plain text untouched', () => {
    expect(decodeEntities('Prendre rendez-vous')).toBe('Prendre rendez-vous');
  });
});

describe('parseMyMemory entity handling', () => {
  const { parseMyMemory } = require('./translate');

  it('returns decoded text, not the raw escaped payload', () => {
    const payload = { responseData: { translatedText: 'S&#39;abonner' } };
    expect(parseMyMemory(payload)).toBe("S'abonner");
  });
});

describe('French glossary', () => {
  const { GLOSSARY } = require('../data/frGlossary');

  it('keeps nav labels short enough for the navbar width budget', () => {
    // "Pet Care Tips" machine-translated to 42 chars and overflowed the page.
    for (const label of ['Home', 'Care', 'Shop', 'Pet Travel', 'Pet Care Tips', 'Our Clinic']) {
      expect(GLOSSARY[label]).toBeDefined();
      expect(GLOSSARY[label].length).toBeLessThanOrEqual(17);
    }
  });

  it('protects the brand from being translated', () => {
    // The provider turned "VitalPaws" into "Vital Pattes".
    expect(GLOSSARY.VitalPaws).toBe('VitalPaws');
    expect(GLOSSARY.Paws).toBe('Paws');
    expect(GLOSSARY.WhatsApp).toBe('WhatsApp');
  });

  it('uses the animal sense of "coat", not the garment', () => {
    expect(GLOSSARY['Skin & Coat']).toBe('Peau et pelage');
  });
});

describe('providerEnabled', () => {
  const { providerEnabled } = require('./translate');
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('is off by default — the French is hand-written', () => {
    delete process.env.TRANSLATION_PROVIDER;
    delete process.env.DEEPL_API_KEY;
    expect(providerEnabled()).toBe(false);
  });

  it('turns on when a DeepL key is present', () => {
    delete process.env.TRANSLATION_PROVIDER;
    process.env.DEEPL_API_KEY = 'x';
    expect(providerEnabled()).toBe(true);
  });

  it('can be forced on for MyMemory', () => {
    process.env.TRANSLATION_PROVIDER = 'mymemory';
    delete process.env.DEEPL_API_KEY;
    expect(providerEnabled()).toBe(true);
  });

  it('an explicit "none" beats a present DeepL key', () => {
    process.env.TRANSLATION_PROVIDER = 'none';
    process.env.DEEPL_API_KEY = 'x';
    expect(providerEnabled()).toBe(false);
  });
});
