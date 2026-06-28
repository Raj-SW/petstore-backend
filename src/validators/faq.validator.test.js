const { validateFaq, validateFaqUpdate } = require('./faq.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

describe('validateFaq', () => {
  it('passes a valid question/answer pair', () => {
    expect(run(validateFaq, { question: 'How?', answer: 'Like this.' }).err).toBeNull();
  });

  it('requires both question and answer', () => {
    expect(run(validateFaq, { question: 'How?' }).err).toBeInstanceOf(AppError);
  });

  it('strips unknown fields', () => {
    const { body } = run(validateFaq, { question: 'How?', answer: 'Like this.', evil: 1 });
    expect(body.evil).toBeUndefined();
  });
});

describe('validateFaqUpdate', () => {
  it('requires at least one field', () => {
    expect(run(validateFaqUpdate, {}).err.message).toMatch(/At least one field/);
  });
  it('passes a single-field update', () => {
    expect(run(validateFaqUpdate, { active: false }).err).toBeNull();
  });
});
