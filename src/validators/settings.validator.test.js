const { validateSettingsUpdate } = require('./settings.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (body) => {
  const req = { body: { ...body } };
  let err = null;
  validateSettingsUpdate(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

describe('validateSettingsUpdate', () => {
  it('passes a valid partial update', () => {
    expect(run({ shippingFlatFee: 50 }).err).toBeNull();
  });

  it('requires at least one field', () => {
    expect(run({}).err).toBeInstanceOf(AppError);
  });

  it('rejects a negative shipping fee', () => {
    expect(run({ shippingFlatFee: -1 }).err.message).toMatch(/cannot be negative/);
  });

  it('bounds tax rate to 0–100', () => {
    expect(run({ taxRatePercent: 150 }).err.message).toMatch(/cannot exceed 100/);
  });

  it('coerces string booleans for taxInclusive', () => {
    const { err, body } = run({ taxInclusive: 'true' });
    expect(err).toBeNull();
    expect(body.taxInclusive).toBe(true);
  });
});
