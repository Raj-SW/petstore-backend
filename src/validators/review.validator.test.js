const { validateReview } = require('./review.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (body) => {
  let captured = null;
  validateReview({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

describe('validateReview', () => {
  it('passes a valid review', () => {
    expect(run({ rating: 5, comment: 'Great product, highly recommend!' })).toBeNull();
  });

  it('rejects rating below 1 or above 5', () => {
    expect(run({ rating: 0, comment: 'x'.repeat(10) })).toBeInstanceOf(AppError);
    expect(run({ rating: 6, comment: 'x'.repeat(10) })).toBeInstanceOf(AppError);
  });

  it('rejects a comment shorter than 10 chars', () => {
    expect(run({ rating: 4, comment: 'short' })).toBeInstanceOf(AppError);
  });

  it('rejects a comment longer than 500 chars', () => {
    expect(run({ rating: 4, comment: 'x'.repeat(501) })).toBeInstanceOf(AppError);
  });

  it('requires both rating and comment', () => {
    expect(run({ rating: 4 })).toBeInstanceOf(AppError);
    expect(run({ comment: 'x'.repeat(10) })).toBeInstanceOf(AppError);
  });
});
