const { validateAdvert, validateAdvertUpdate } = require('./advert.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

describe('validateAdvert', () => {
  it('requires a link for banner placement', () => {
    expect(run(validateAdvert, { title: 'Promo', placement: 'banner' }).err.message)
      .toMatch(/link is required/);
  });

  it('passes a banner with a link', () => {
    expect(run(validateAdvert, { title: 'Promo', placement: 'banner', link: '/petshop' }).err)
      .toBeNull();
  });

  it('allows hero placement without a link', () => {
    expect(run(validateAdvert, { title: 'Hero slide', placement: 'hero' }).err).toBeNull();
  });

  it('requires title and placement', () => {
    expect(run(validateAdvert, { placement: 'hero' }).err).toBeInstanceOf(AppError);
    expect(run(validateAdvert, { title: 'X' , link: '/x', placement: 'invalid' }).err)
      .toBeInstanceOf(AppError);
  });
});

describe('validateAdvertUpdate', () => {
  it('requires at least one field', () => {
    expect(run(validateAdvertUpdate, {}).err.message).toMatch(/At least one field/);
  });

  it('passes a single-field update', () => {
    expect(run(validateAdvertUpdate, { active: false }).err).toBeNull();
  });

  it('rejects an invalid placement', () => {
    expect(run(validateAdvertUpdate, { placement: 'nope' }).err).toBeInstanceOf(AppError);
  });
});
