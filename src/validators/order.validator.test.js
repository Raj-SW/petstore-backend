const {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validatePaymentStatus,
} = require('./order.validator');
const { AppError } = require('../middlewares/errorHandler');

const run = (validator, body) => {
  let captured = null;
  validator({ body }, {}, (err) => { captured = err || null; });
  return captured;
};

const validAddress = {
  street: '123 Main St', city: 'Port Louis', state: 'PL', country: 'Mauritius', zipCode: '11101',
};

describe('validateCreateOrder', () => {
  it('passes a complete order', () => {
    expect(run(validateCreateOrder, {
      shippingAddress: validAddress, paymentMethod: 'stripe', notes: 'Leave at door',
    })).toBeNull();
  });

  it('requires every shipping address field', () => {
    const { zipCode, ...partial } = validAddress;
    expect(run(validateCreateOrder, { shippingAddress: partial, paymentMethod: 'stripe' }))
      .toBeInstanceOf(AppError);
  });

  it('rejects an unsupported payment method', () => {
    expect(run(validateCreateOrder, { shippingAddress: validAddress, paymentMethod: 'bitcoin' }))
      .toBeInstanceOf(AppError);
  });

  it('rejects notes longer than 500 chars', () => {
    expect(run(validateCreateOrder, {
      shippingAddress: validAddress, paymentMethod: 'paypal', notes: 'x'.repeat(501),
    })).toBeInstanceOf(AppError);
  });
});

describe('validateUpdateOrderStatus', () => {
  it('accepts a valid status alone', () => {
    expect(run(validateUpdateOrderStatus, { status: 'shipped' })).toBeNull();
  });
  it('rejects an unknown status', () => {
    expect(run(validateUpdateOrderStatus, { status: 'teleported' })).toBeInstanceOf(AppError);
  });
  it('accepts optional tracking metadata', () => {
    expect(run(validateUpdateOrderStatus, {
      status: 'shipped', trackingNumber: 'TRK1', estimatedDelivery: '2026-07-01',
    })).toBeNull();
  });
});

describe('validatePaymentStatus', () => {
  it('requires transactionId and paymentDate when completed', () => {
    expect(run(validatePaymentStatus, { paymentStatus: 'completed' })).toBeInstanceOf(AppError);
  });

  it('passes a complete "completed" payment', () => {
    expect(run(validatePaymentStatus, {
      paymentStatus: 'completed', transactionId: 'tx1', paymentDate: '2026-06-28',
    })).toBeNull();
  });

  it('does not require metadata for failed/refunded', () => {
    expect(run(validatePaymentStatus, { paymentStatus: 'failed' })).toBeNull();
    expect(run(validatePaymentStatus, { paymentStatus: 'refunded' })).toBeNull();
  });

  it('rejects an unknown payment status', () => {
    expect(run(validatePaymentStatus, { paymentStatus: 'pending' })).toBeInstanceOf(AppError);
  });
});
