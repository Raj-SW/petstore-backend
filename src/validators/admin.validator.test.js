const { validateAnalyticsPeriod, validateDateRange } = require('./admin.validator');
const { AppError } = require('../middlewares/errorHandler');

// These validators read req.query.
const run = (validator, query) => {
  let err = null;
  validator({ query }, {}, (e) => { err = e || null; });
  return err;
};

describe('validateAnalyticsPeriod', () => {
  it('accepts a valid period', () => {
    expect(run(validateAnalyticsPeriod, { period: 'weekly' })).toBeNull();
  });
  it('accepts an empty query (default monthly)', () => {
    expect(run(validateAnalyticsPeriod, {})).toBeNull();
  });
  it('rejects an unknown period', () => {
    expect(run(validateAnalyticsPeriod, { period: 'hourly' })).toBeInstanceOf(AppError);
  });
});

describe('validateDateRange', () => {
  it('passes a valid ISO range', () => {
    expect(run(validateDateRange, { startDate: '2026-01-01', endDate: '2026-02-01' })).toBeNull();
  });
  it('rejects endDate before startDate', () => {
    expect(run(validateDateRange, { startDate: '2026-02-01', endDate: '2026-01-01' }))
      .toBeInstanceOf(AppError);
  });
  it('requires both dates', () => {
    expect(run(validateDateRange, { startDate: '2026-01-01' })).toBeInstanceOf(AppError);
  });
});
