const { validateBulkAction } = require('./bulkAction.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (body) => {
  const req = { body: { ...body } };
  let err = null;
  validateBulkAction(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const OID = '507f1f77bcf86cd799439011';

describe('validateBulkAction', () => {
  it('passes a simple activate action', () => {
    expect(run({ action: 'activate', ids: [OID] }).err).toBeNull();
  });

  it('rejects an unknown action', () => {
    expect(run({ action: 'nuke', ids: [OID] }).err).toBeInstanceOf(AppError);
  });

  it('requires at least one id', () => {
    expect(run({ action: 'delete', ids: [] }).err).toBeInstanceOf(AppError);
  });

  it('rejects more than 100 ids', () => {
    expect(run({ action: 'delete', ids: Array(101).fill(OID) }).err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid ObjectId in the list', () => {
    expect(run({ action: 'activate', ids: [OID, 'bad-id'] }).err.message)
      .toMatch(/IDs are invalid/);
  });

  it('requires options for the sale action', () => {
    expect(run({ action: 'sale', ids: [OID] }).err.message)
      .toMatch(/Sale options are required/);
  });

  it('bounds percentage sale discount to 1–100', () => {
    expect(run({
      action: 'sale', ids: [OID],
      options: { discountType: 'percent', discountValue: 150 },
    }).err.message).toMatch(/between 1 and 100/);
  });

  it('rejects a sale end date not after the start date', () => {
    expect(run({
      action: 'sale', ids: [OID],
      options: {
        discountType: 'percent', discountValue: 10,
        saleStartsAt: '2026-07-10', saleEndsAt: '2026-07-01',
      },
    }).err.message).toMatch(/end date must be after/);
  });

  it('passes a valid sale action', () => {
    expect(run({
      action: 'sale', ids: [OID],
      options: { discountType: 'percent', discountValue: 20 },
    }).err).toBeNull();
  });
});
