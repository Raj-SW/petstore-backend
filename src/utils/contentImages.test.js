const { coerceCoverImage, collectImagePublicIds } = require('./contentImages');

describe('coerceCoverImage', () => {
  it('returns undefined for null/undefined', () => {
    expect(coerceCoverImage(undefined)).toBeUndefined();
    expect(coerceCoverImage(null)).toBeUndefined();
  });

  it('wraps a bare URL string into { url, publicId }', () => {
    expect(coerceCoverImage('http://img/x.jpg')).toEqual({
      url: 'http://img/x.jpg', publicId: '',
    });
  });

  it('normalises an object, defaulting missing fields', () => {
    expect(coerceCoverImage({ url: 'u', publicId: 'p' })).toEqual({ url: 'u', publicId: 'p' });
    expect(coerceCoverImage({})).toEqual({ url: '', publicId: '' });
  });
});

describe('collectImagePublicIds', () => {
  it('returns [] for falsy input', () => {
    expect(collectImagePublicIds(null)).toEqual([]);
    expect(collectImagePublicIds(undefined)).toEqual([]);
  });

  it('collects the cover image publicId', () => {
    expect(collectImagePublicIds({ coverImage: { publicId: 'cover1' } })).toEqual(['cover1']);
  });

  it('ignores a cover image without a publicId', () => {
    expect(collectImagePublicIds({ coverImage: { url: 'u' } })).toEqual([]);
    expect(collectImagePublicIds({ coverImage: 'string-url' })).toEqual([]);
  });

  it('collects publicIds from nested section images', () => {
    const source = {
      coverImage: { publicId: 'cover' },
      sections: [
        { images: [{ publicId: 'a' }, { publicId: 'b' }] },
        { images: [{ url: 'no-id' }, { publicId: 'c' }] },
        { images: [] },
        {},
      ],
    };
    expect(collectImagePublicIds(source)).toEqual(['cover', 'a', 'b', 'c']);
  });

  it('handles sections that is not an array', () => {
    expect(collectImagePublicIds({ sections: 'nope' })).toEqual([]);
  });
});
