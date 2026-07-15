/**
 * Unit tests for PayPalService currency handling (audit P0 #2).
 *
 * Order amounts are MUR; PayPal does not support MUR. The service must
 * convert via PAYPAL_MUR_TO_USD_RATE — never submit the raw MUR number
 * as USD (a ~40x overcharge) — and refunds must be full-capture refunds.
 */
const mockCreateOrder = jest.fn();
const mockCaptureOrder = jest.fn();
const mockRefundCapturedPayment = jest.fn();

jest.mock('@paypal/paypal-server-sdk', () => ({
  Client: jest.fn(),
  Environment: { Production: 'production', Sandbox: 'sandbox' },
  CheckoutPaymentIntent: { Capture: 'CAPTURE' },
  OrdersController: jest.fn().mockImplementation(() => ({
    createOrder: mockCreateOrder,
    captureOrder: mockCaptureOrder,
  })),
  PaymentsController: jest.fn().mockImplementation(() => ({
    refundCapturedPayment: mockRefundCapturedPayment,
  })),
}));

jest.mock('../config/urls', () => ({ frontendUrl: (p) => `https://front.test/${p}` }));
jest.mock('../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));

const PayPalService = require('./paypal.service');

const ORDER = {
  _id: 'order123',
  finalAmount: 4500, // MUR
  totalAmount: 4500,
  discount: 0,
  items: [{ product: { name: 'Dog Food' }, price: 2250, quantity: 2 }],
  paymentDetails: { transactionId: 'CAPTURE-1' },
};

describe('PayPalService.createOrder — MUR→USD conversion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PAYPAL_MUR_TO_USD_RATE;
  });

  it('refuses with 503 when no conversion rate is configured (never charges raw MUR as USD)', async () => {
    await expect(PayPalService.createOrder(ORDER)).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it('converts the MUR total to USD at the configured rate', async () => {
    process.env.PAYPAL_MUR_TO_USD_RATE = '45';
    mockCreateOrder.mockResolvedValue({ result: { id: 'PP-1', links: [] } });

    await PayPalService.createOrder(ORDER);

    const body = mockCreateOrder.mock.calls[0][0].body;
    const amount = body.purchaseUnits[0].amount;
    expect(amount.currencyCode).toBe('USD');
    expect(amount.value).toBe('100.00'); // 4500 MUR / 45 = 100 USD
  });

  it('rejects a zero/invalid configured rate', async () => {
    process.env.PAYPAL_MUR_TO_USD_RATE = '0';
    await expect(PayPalService.createOrder(ORDER)).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('sends no per-item breakdown (avoids rounding drift PayPal rejects)', async () => {
    process.env.PAYPAL_MUR_TO_USD_RATE = '45';
    mockCreateOrder.mockResolvedValue({ result: { id: 'PP-1', links: [] } });

    await PayPalService.createOrder(ORDER);

    const unit = mockCreateOrder.mock.calls[0][0].body.purchaseUnits[0];
    expect(unit.amount.breakdown).toBeUndefined();
    expect(unit.items).toBeUndefined();
  });
});

describe('PayPalService.processRefund — full-capture refund', () => {
  beforeEach(() => jest.clearAllMocks());

  it('omits the amount so PayPal refunds exactly what was captured', async () => {
    mockRefundCapturedPayment.mockResolvedValue({
      result: { id: 'REFUND-1', amount: { value: '100.00' } },
    });

    const result = await PayPalService.processRefund(ORDER);

    expect(mockRefundCapturedPayment).toHaveBeenCalledWith({
      captureId: 'CAPTURE-1',
      body: {},
    });
    expect(result.status).toBe('refunded');
  });

  it('fails cleanly when the order has no capture transaction', async () => {
    await expect(
      PayPalService.processRefund({ ...ORDER, paymentDetails: {} })
    ).rejects.toBeTruthy();
    expect(mockRefundCapturedPayment).not.toHaveBeenCalled();
  });
});
