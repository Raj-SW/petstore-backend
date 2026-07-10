const Product = require('./product.model');

// doc.validate() runs pre('validate') hooks without a DB connection.
const makeProduct = (extra = {}) => new Product({
  name: 'Rice Bag',
  description: 'A very nice bag of rice for pets',
  price: 1,
  quantity: 0,
  categories: ['general'],
  createdBy: '507f1f77bcf86cd799439011',
  ...extra,
});

const OPTS = [
  { name: 'Weight', values: ['5kg', '10kg'] },
  { name: 'Flavour', values: ['Chicken', 'Beef'] },
];

describe('Product option matrix', () => {
  it('accepts a valid matrix, derives labels and rolls up price/quantity', async () => {
    const p = makeProduct({
      options: OPTS,
      variants: [
        { label: 'x', optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 100, quantity: 3 },
        { label: 'x', optionValues: { Weight: '10kg', Flavour: 'Beef' }, price: 180, quantity: 2 },
      ],
    });
    await p.validate();
    expect(p.variants[0].label).toBe('5kg · Chicken');
    expect(p.price).toBe(100); // min variant price
    expect(p.quantity).toBe(5); // summed stock
    expect(p.variantsView[0].optionValues).toEqual({ Weight: '5kg', Flavour: 'Chicken' });
  });

  it('rejects a duplicate combination', async () => {
    const p = makeProduct({
      options: OPTS,
      variants: [
        { label: 'x', optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 100, quantity: 1 },
        { label: 'x', optionValues: { Weight: '5kg', Flavour: 'Chicken' }, price: 120, quantity: 1 },
      ],
    });
    await expect(p.validate()).rejects.toThrow(/duplicate combination/i);
  });

  it('rejects more than 4 axes', async () => {
    const p = makeProduct({
      options: Array.from({ length: 5 }, (_, i) => ({ name: `A${i}`, values: ['v'] })),
    });
    await expect(p.validate()).rejects.toThrow(/at most 4/i);
  });

  it('legacy variants without options still validate, label untouched', async () => {
    const p = makeProduct({ variants: [{ label: '5kg', price: 50, quantity: 2 }] });
    await p.validate();
    expect(p.variants[0].label).toBe('5kg');
    expect(p.variantsView[0].optionValues).toBeUndefined();
  });
});
