const { formatMUR } = require('../src/utils/currency');

describe('formatMUR (Epic 6c)', () => {
  it('formats whole numbers with thousands separators', () => {
    expect(formatMUR(1234)).toBe('Rs 1,234');
  });
  it('keeps decimals when present', () => {
    expect(formatMUR(1234.5)).toBe('Rs 1,234.5');
  });
  it('handles 0 / null / undefined', () => {
    expect(formatMUR(0)).toBe('Rs 0');
    expect(formatMUR(null)).toBe('Rs 0');
    expect(formatMUR(undefined)).toBe('Rs 0');
  });
});
