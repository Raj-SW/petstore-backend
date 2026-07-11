const {
  deriveProductFromVariants,
  validateOptionMatrix,
  applyDerivedVariantLabels,
} = require('./productVariants');

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

describe('validateOptionMatrix', () => {
  const opts = [
    { name: 'Weight', values: ['5kg', '10kg'] },
    { name: 'Flavour', values: ['Chicken', 'Beef'] },
  ];

  it('accepts a valid 2-axis matrix', () => {
    expect(validateOptionMatrix(opts, [
      { optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 100, quantity: 3 },
      { optionValues: { Weight: '10kg', Flavour: 'Beef' }, price: 180, quantity: 1 },
    ])).toBeNull();
  });

  it('accepts empty options with legacy free-label variants', () => {
    expect(validateOptionMatrix([], [{ label: '5kg', price: 100, quantity: 1 }])).toBeNull();
    expect(validateOptionMatrix(undefined, [])).toBeNull();
  });

  it('rejects more than 4 axes', () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ name: `Axis${i}`, values: ['a'] }));
    expect(validateOptionMatrix(five, [])).toMatch(/at most 4/i);
  });

  it('rejects duplicate axis names (case-insensitive)', () => {
    expect(validateOptionMatrix(
      [{ name: 'Weight', values: ['5kg'] }, { name: 'weight', values: ['x'] }], [],
    )).toMatch(/duplicate option name/i);
  });

  it('rejects an axis with no values or duplicate values', () => {
    expect(validateOptionMatrix([{ name: 'Weight', values: [] }], [])).toMatch(/at least one value/i);
    expect(validateOptionMatrix([{ name: 'Weight', values: ['5kg', '5kg'] }], [])).toMatch(/duplicate value/i);
  });

  it('rejects a variant whose optionValues keys mismatch the axes', () => {
    expect(validateOptionMatrix(opts, [
      { optionValues: { Weight: '5kg' }, price: 100, quantity: 1 },
    ])).toMatch(/must set every option/i);
  });

  it('rejects a variant whose value is not in the axis list', () => {
    expect(validateOptionMatrix(opts, [
      { optionValues: { Weight: '7kg', Flavour: 'Chicken' }, price: 100, quantity: 1 },
    ])).toMatch(/not a listed value/i);
  });

  it('rejects duplicate combinations', () => {
    expect(validateOptionMatrix(opts, [
      { optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 100, quantity: 1 },
      { optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 120, quantity: 2 },
    ])).toMatch(/duplicate combination/i);
  });

  it('accepts a Map optionValues (mongoose subdoc shape)', () => {
    expect(validateOptionMatrix(opts, [
      { optionValues: new Map([['Weight', '5kg'], ['Flavour', 'Beef']]), price: 90, quantity: 1 },
    ])).toBeNull();
  });
});

describe('applyDerivedVariantLabels', () => {
  it('derives "5kg · Chicken" in axis order', () => {
    const variants = [{ label: 'stale', optionValues: { Flavour: 'Chicken', Weight: '5kg' }, price: 1, quantity: 1 }];
    applyDerivedVariantLabels(
      [{ name: 'Weight', values: ['5kg'] }, { name: 'Flavour', values: ['Chicken'] }],
      variants,
    );
    expect(variants[0].label).toBe('5kg · Chicken');
  });

  it('is a no-op without options', () => {
    const variants = [{ label: '5kg', price: 1, quantity: 1 }];
    applyDerivedVariantLabels([], variants);
    expect(variants[0].label).toBe('5kg');
  });
});
