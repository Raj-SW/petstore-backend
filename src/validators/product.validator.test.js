const { validateProduct, validateProductUpdate } = require('./product.validator');
const { AppError } = require('../middlewares/errorHandler');

// These validators mutate req.body (normalisation + Joi defaults), so build a
// fresh req each time and return { err, body }.
const run = (validator, body) => {
  const req = { body: { ...body } };
  let err = null;
  validator(req, {}, (e) => { err = e || null; });
  return { err, body: req.body };
};

const base = {
  name: 'Dog Food',
  description: 'A wholesome meal for dogs.',
  categories: ['food'],
  price: 100,
  quantity: 10,
};

describe('validateProduct — basics', () => {
  it('passes a minimal valid product', () => {
    expect(run(validateProduct, base).err).toBeNull();
  });

  it('normalises a single string category into an array', () => {
    const { err, body } = run(validateProduct, { ...base, categories: 'food' });
    expect(err).toBeNull();
    expect(body.categories).toEqual(['food']);
  });

  it('requires at least one category', () => {
    const { categories, ...noCat } = base;
    expect(run(validateProduct, noCat).err).toBeInstanceOf(AppError);
  });

  it('rejects a name shorter than 2 chars', () => {
    expect(run(validateProduct, { ...base, name: 'D' }).err).toBeInstanceOf(AppError);
  });

  it('rejects a description shorter than 10 chars', () => {
    expect(run(validateProduct, { ...base, description: 'short' }).err).toBeInstanceOf(AppError);
  });

  it('requires either variants OR price+quantity', () => {
    const { price, quantity, ...noPricing } = base;
    const err = run(validateProduct, noPricing).err;
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toMatch(/price and quantity/);
  });
});

describe('validateProduct — sale cross-field rules', () => {
  it('requires a positive discountValue when onSale', () => {
    const err = run(validateProduct, { ...base, onSale: true, discountValue: 0 }).err;
    expect(err.message).toMatch(/discount value greater than 0/);
  });

  it('bounds percentage discounts to 1–100', () => {
    expect(run(validateProduct, {
      ...base, onSale: true, discountType: 'percent', discountValue: 150,
    }).err.message).toMatch(/between 1 and 100/);
  });

  it('requires a fixed sale price below the product price', () => {
    expect(run(validateProduct, {
      ...base, onSale: true, discountType: 'amount', discountValue: 200,
    }).err.message).toMatch(/less than the product price/);
  });

  it('passes a valid percentage sale', () => {
    expect(run(validateProduct, {
      ...base, onSale: true, discountType: 'percent', discountValue: 25,
    }).err).toBeNull();
  });

  it('rejects a sale end date that is not after the start date', () => {
    expect(run(validateProduct, {
      ...base, onSale: true, discountType: 'percent', discountValue: 10,
      saleStartsAt: '2026-07-10', saleEndsAt: '2026-07-01',
    }).err.message).toMatch(/end date must be after/);
  });
});

describe('validateProduct — variants', () => {
  it('accepts a valid variants JSON array (no top-level price/quantity needed)', () => {
    const { price, quantity, ...noPricing } = base;
    const err = run(validateProduct, {
      ...noPricing,
      variants: JSON.stringify([{ label: 'S', price: 100, quantity: 5 }]),
    }).err;
    expect(err).toBeNull();
  });

  it('rejects malformed variants JSON', () => {
    const err = run(validateProduct, { ...base, variants: '{not json' }).err;
    expect(err.message).toMatch(/Invalid variants format/);
  });

  it('rejects a variant missing a label or with negative price', () => {
    const err = run(validateProduct, {
      ...base, variants: JSON.stringify([{ price: -1, quantity: 5 }]),
    }).err;
    expect(err.message).toMatch(/Each variant needs/);
  });
});

describe('validateProductUpdate', () => {
  it('passes an empty update (all fields optional)', () => {
    expect(run(validateProductUpdate, {}).err).toBeNull();
  });

  it('passes a partial field update', () => {
    expect(run(validateProductUpdate, { price: 250 }).err).toBeNull();
  });

  it('still enforces sale rules on update', () => {
    const err = run(validateProductUpdate, {
      onSale: true, discountType: 'percent', discountValue: 0,
    }).err;
    expect(err).toBeInstanceOf(AppError);
  });

  it('rejects an invalid gender enum', () => {
    expect(run(validateProductUpdate, { genders: ['Alien'] }).err).toBeInstanceOf(AppError);
  });
});
