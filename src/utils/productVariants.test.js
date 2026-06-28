const { deriveProductFromVariants } = require('./productVariants');

describe('deriveProductFromVariants', () => {
  it('returns null when there are no variants', () => {
    expect(deriveProductFromVariants([])).toBeNull();
    expect(deriveProductFromVariants(null)).toBeNull();
    expect(deriveProductFromVariants(undefined)).toBeNull();
  });

  it('picks the lowest variant price and sums quantities', () => {
    const result = deriveProductFromVariants([
      { price: 300, quantity: 2 },
      { price: 150, quantity: 5 },
      { price: 220, quantity: 0 },
    ]);
    expect(result).toEqual({ price: 150, quantity: 7 });
  });

  it('coerces string prices/quantities to numbers', () => {
    expect(deriveProductFromVariants([
      { price: '99', quantity: '3' },
      { price: '199', quantity: '1' },
    ])).toEqual({ price: 99, quantity: 4 });
  });

  it('treats missing/invalid quantity as 0', () => {
    expect(deriveProductFromVariants([
      { price: 50, quantity: undefined },
      { price: 60 },
    ])).toEqual({ price: 50, quantity: 0 });
  });

  it('handles a single variant', () => {
    expect(deriveProductFromVariants([{ price: 42, quantity: 9 }]))
      .toEqual({ price: 42, quantity: 9 });
  });
});
