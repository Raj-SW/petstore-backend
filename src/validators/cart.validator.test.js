const {
  validateAddToCart,
  validateUpdateCartItem,
  validateApplyDiscount,
} = require('./cart.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  let captured = null;
  validator({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

describe('validateAddToCart', () => {
  it('passes with productId and quantity', () => {
    expect(run(validateAddToCart, { productId: 'p1', quantity: 2 })).toBeNull();
  });

  it('accepts an optional 24-char hex variantId', () => {
    expect(run(validateAddToCart, {
      productId: 'p1', quantity: 1, variantId: '507f1f77bcf86cd799439011',
    })).toBeNull();
  });

  it('rejects a malformed variantId', () => {
    expect(run(validateAddToCart, { productId: 'p1', quantity: 1, variantId: 'xyz' }))
      .toBeInstanceOf(AppError);
  });

  it('rejects quantity < 1', () => {
    expect(run(validateAddToCart, { productId: 'p1', quantity: 0 })).toBeInstanceOf(AppError);
  });

  it('requires productId', () => {
    expect(run(validateAddToCart, { quantity: 1 })).toBeInstanceOf(AppError);
  });
});

describe('validateUpdateCartItem', () => {
  it('passes with a valid quantity', () => {
    expect(run(validateUpdateCartItem, { quantity: 3 })).toBeNull();
  });
  it('rejects quantity < 1', () => {
    expect(run(validateUpdateCartItem, { quantity: 0 })).toBeInstanceOf(AppError);
  });
});

describe('validateApplyDiscount', () => {
  it('passes with a discount code', () => {
    expect(run(validateApplyDiscount, { discountCode: 'SAVE10' })).toBeNull();
  });
  it('requires a discount code', () => {
    expect(run(validateApplyDiscount, {})).toBeInstanceOf(AppError);
  });
});
