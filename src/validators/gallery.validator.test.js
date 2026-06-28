const { validateGalleryPost, validateGalleryPostUpdate } = require('./gallery.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const validPost = {
  title: 'Adoption Day',
  body: 'We hosted a great event.',
  category: 'event',
  eventDate: '2026-06-01',
};

describe('validateGalleryPost', () => {
  it('passes a complete post', () => {
    expect(run(validateGalleryPost, validPost).err).toBeNull();
  });

  it('requires title, body, category, eventDate', () => {
    expect(run(validateGalleryPost, { title: 'Only title' }).err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid category', () => {
    expect(run(validateGalleryPost, { ...validPost, category: 'gossip' }).err)
      .toBeInstanceOf(AppError);
  });

  it('normalises a comma-separated tags string into an array', () => {
    const { err, body } = run(validateGalleryPost, { ...validPost, tags: 'fun, pets ,2026' });
    expect(err).toBeNull();
    expect(body.tags).toEqual(['fun', 'pets', '2026']);
  });
});

describe('validateGalleryPostUpdate', () => {
  it('requires at least one field', () => {
    expect(run(validateGalleryPostUpdate, {}).err.message).toMatch(/At least one field/);
  });
  it('passes a partial update', () => {
    expect(run(validateGalleryPostUpdate, { featured: true }).err).toBeNull();
  });
});
