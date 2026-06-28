const { getStartDate, getDateFormat } = require('./dateUtils');
const { AppError } = require('../middlewares/errorHandler');

describe('getStartDate', () => {
  // Helper: whole-day difference between now and the returned start date.
  const daysAgo = (date) => Math.round((Date.now() - date.getTime()) / 86400000);

  it('returns ~7 days ago for "weekly"', () => {
    expect(daysAgo(getStartDate('weekly'))).toBe(7);
  });

  it('returns roughly a month ago for "monthly"', () => {
    const d = getStartDate('monthly');
    const now = new Date();
    // Either previous month, or December of last year when run in January.
    const expectedMonth = (now.getMonth() + 11) % 12;
    expect(d.getMonth()).toBe(expectedMonth);
  });

  it('returns roughly a year ago for "yearly"', () => {
    const d = getStartDate('yearly');
    expect(d.getFullYear()).toBe(new Date().getFullYear() - 1);
  });

  it('throws an AppError(400) for an unknown period', () => {
    expect(() => getStartDate('hourly')).toThrow(AppError);
    expect(() => getStartDate('hourly')).toThrow('Invalid period specified');
  });
});

describe('getDateFormat', () => {
  it('uses month granularity for yearly', () => {
    expect(getDateFormat('yearly')).toBe('%Y-%m');
  });

  it('uses day granularity otherwise', () => {
    expect(getDateFormat('weekly')).toBe('%Y-%m-%d');
    expect(getDateFormat('monthly')).toBe('%Y-%m-%d');
    expect(getDateFormat(undefined)).toBe('%Y-%m-%d');
  });
});
