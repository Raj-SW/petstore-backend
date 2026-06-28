const { validateTip, validateTipUpdate } = require('./tip.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const validTip = {
  title: 'Brushing 101',
  body: 'Brush your dog regularly.',
  animalType: 'dog',
  category: 'grooming',
};

describe('validateTip', () => {
  it('passes a complete tip', () => {
    expect(run(validateTip, validTip).err).toBeNull();
  });

  it('requires title, body, animalType, category', () => {
    expect(run(validateTip, { title: 'x'.repeat(3) }).err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid animalType', () => {
    expect(run(validateTip, { ...validTip, animalType: 'dragon' }).err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid category', () => {
    expect(run(validateTip, { ...validTip, category: 'astrology' }).err).toBeInstanceOf(AppError);
  });

  it('accepts a coverImage object', () => {
    expect(run(validateTip, {
      ...validTip, coverImage: { url: 'http://img/x.jpg', publicId: 'p' },
    }).err).toBeNull();
  });

  it('rejects a section with more than 8 images', () => {
    expect(run(validateTip, {
      ...validTip,
      sections: [{ heading: 'H', images: Array(9).fill({ url: 'u', publicId: 'p' }) }],
    }).err.message).toMatch(/at most 8 images/);
  });
});

describe('validateTipUpdate', () => {
  it('requires at least one field', () => {
    expect(run(validateTipUpdate, {}).err.message).toMatch(/At least one field/);
  });
  it('passes a partial update', () => {
    expect(run(validateTipUpdate, { featured: true }).err).toBeNull();
  });
});
