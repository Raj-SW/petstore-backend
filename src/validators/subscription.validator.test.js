const {
  validateCreateSubscription,
  validateUpdateSubscription,
} = require('./subscription.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const OID = '507f1f77bcf86cd799439011';
const validAddress = {
  street: '1 St', city: 'PL', state: 'PL', country: 'MU', zipCode: '11101',
};
const validCreate = {
  items: [{ product: OID, quantity: 2 }],
  shippingAddress: validAddress,
  paymentMethod: 'stripe',
  intervalUnit: 'week',
  intervalCount: 2,
  source: 'product',
};

describe('validateCreateSubscription', () => {
  it('passes a valid weekly subscription', () => {
    expect(run(validateCreateSubscription, validCreate).err).toBeNull();
  });

  it('enforces a 7-day minimum interval (6 days rejected)', () => {
    const err = run(validateCreateSubscription, {
      ...validCreate, intervalUnit: 'day', intervalCount: 6,
    }).err;
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toMatch(/Minimum interval is 7 days/);
  });

  it('accepts exactly 7 days', () => {
    expect(run(validateCreateSubscription, {
      ...validCreate, intervalUnit: 'day', intervalCount: 7,
    }).err).toBeNull();
  });

  it('requires at least one item', () => {
    expect(run(validateCreateSubscription, { ...validCreate, items: [] }).err)
      .toBeInstanceOf(AppError);
  });

  it('rejects a non-hex product id', () => {
    expect(run(validateCreateSubscription, {
      ...validCreate, items: [{ product: 'nope', quantity: 1 }],
    }).err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid source', () => {
    expect(run(validateCreateSubscription, { ...validCreate, source: 'wild' }).err)
      .toBeInstanceOf(AppError);
  });
});

describe('validateUpdateSubscription', () => {
  it('passes a single-field status update', () => {
    expect(run(validateUpdateSubscription, { status: 'paused' }).err).toBeNull();
  });

  it('rejects an empty update (min(1) key required)', () => {
    expect(run(validateUpdateSubscription, {}).err).toBeInstanceOf(AppError);
  });

  it('enforces the 7-day minimum when both interval fields are present', () => {
    expect(run(validateUpdateSubscription, { intervalUnit: 'day', intervalCount: 3 }).err)
      .toBeInstanceOf(AppError);
  });

  it('accepts the skip action', () => {
    expect(run(validateUpdateSubscription, { action: 'skip' }).err).toBeNull();
  });

  it('bounds discountPercent to 0–100', () => {
    expect(run(validateUpdateSubscription, { discountPercent: 150 }).err)
      .toBeInstanceOf(AppError);
  });
});
