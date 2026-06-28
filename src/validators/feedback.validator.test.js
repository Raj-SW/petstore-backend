const { validateFeedback } = require('./feedback.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (body) => {
  const req = { body: { ...body } };
  let err = null;
  validateFeedback(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const valid = { name: 'Jane', rating: 5, message: 'Loved the service here.' };

describe('validateFeedback', () => {
  it('passes valid feedback and strips unknown fields', () => {
    const { err, body } = run({ ...valid, hacker: 'x' });
    expect(err).toBeNull();
    expect(body.hacker).toBeUndefined();
  });

  it('allows an empty role', () => {
    expect(run({ ...valid, role: '' }).err).toBeNull();
  });

  it('rejects a too-short name', () => {
    expect(run({ ...valid, name: 'J' }).err).toBeInstanceOf(AppError);
  });

  it('rejects rating outside 1–5', () => {
    expect(run({ ...valid, rating: 6 }).err).toBeInstanceOf(AppError);
    expect(run({ ...valid, rating: 0 }).err).toBeInstanceOf(AppError);
  });

  it('rejects a too-short message', () => {
    expect(run({ ...valid, message: 'hi' }).err).toBeInstanceOf(AppError);
  });

  it('requires name, rating and message', () => {
    expect(run({}).err).toBeInstanceOf(AppError);
  });
});
