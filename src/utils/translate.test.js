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
