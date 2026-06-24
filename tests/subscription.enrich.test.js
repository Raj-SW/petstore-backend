const { enrichSubscription } = require('../src/services/subscription.analytics.service');

// Minimal product doubles exposing the same surface enrichSubscription uses.
function product({ effectivePrice, variantPrice }) {
  return {
    price: effectivePrice,
    effectivePrice,
    priceForVariant: () => variantPrice,
  };
}

describe('enrichSubscription', () => {
  const DAY = 24 * 60 * 60 * 1000;

  test('computes perCycleTotal and savings with discount (no variant)', () => {
    const sub = {
      intervalUnit: 'week', intervalCount: 2, discountPercent: 10,
      nextRunAt: new Date(Date.now() + 3 * DAY),
      items: [{ product: product({ effectivePrice: 300 }), quantity: 2 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(540); // 600 * 0.9
    expect(out.savings).toBe(60);
    expect(out.cadenceLabel).toBe('every 2 weeks');
    expect(out.nextRunInDays).toBe(3);
  });

  test('uses priceForVariant when item has a variantId', () => {
    const sub = {
      intervalUnit: 'day', intervalCount: 1, discountPercent: 0,
      nextRunAt: new Date(Date.now() + 1 * DAY),
      items: [{ product: product({ effectivePrice: 999, variantPrice: 100 }), variantId: 'v1', quantity: 3 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(300); // 100 * 3, no discount
    expect(out.savings).toBe(0);
    expect(out.cadenceLabel).toBe('every 1 day');
  });

  test('maps order history to {id,date,total,status}', () => {
    const when = new Date('2026-06-01T00:00:00Z');
    const sub = {
      intervalUnit: 'week', intervalCount: 1, discountPercent: 0,
      nextRunAt: null,
      items: [],
      createdOrders: [{ _id: 'o1', totalAmount: 500, discount: 50, status: 'paid', createdAt: when }],
    };
    const out = enrichSubscription(sub);
    expect(out.nextRunInDays).toBeNull();
    expect(out.orderHistory).toEqual([{ id: 'o1', date: when, total: 450, status: 'paid' }]);
  });

  test('skips unpopulated product items in the price sum', () => {
    const sub = {
      intervalUnit: 'day', intervalCount: 7, discountPercent: 10,
      nextRunAt: new Date(Date.now() + 7 * DAY),
      items: [{ product: 'someObjectId', quantity: 5 }],
      createdOrders: [],
    };
    const out = enrichSubscription(sub);
    expect(out.perCycleTotal).toBe(0);
    expect(out.savings).toBe(0);
  });
});
