const Order = require('../models/order.model');
const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Build an order from an explicit item list, reserving stock and logging
 * stock movements, within the provided mongoose session. The CALLER owns the
 * transaction (commit/abort) and any cart clearing / emails.
 *
 * @param {Object}  opts
 * @param {ObjectId} opts.userId
 * @param {Array}   opts.items            [{ product, quantity }]
 * @param {Object}  opts.shippingAddress
 * @param {String}  opts.paymentMethod
 * @param {String}  [opts.notes]
 * @param {Number}  [opts.discountPercent] 0-100, applied to the computed subtotal
 * @param {String}  [opts.discountCode]
 * @param {String}  [opts.source]          'manual' | 'subscription'
 * @param {ClientSession} opts.session
 * @returns {Promise<Order>} the created order document
 */
async function buildOrder({
  userId, items, shippingAddress, paymentMethod, notes = '',
  discountPercent = 0, discountCode = null, source = 'manual', session,
}) {
  let totalItems = 0;
  let totalAmount = 0;
  const orderItems = [];

  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await Product.findById(item.product).session(session);
    if (!product) throw new AppError('Product not found', 404);
    if (!product.isActive) throw new AppError(`Product ${product.name} is not available`, 400);
    if (product.quantity != null && product.quantity > 0 && product.quantity < item.quantity) {
      throw new AppError(`Insufficient stock for ${product.name}`, 400);
    }
    const price = product.effectivePrice;
    totalItems += item.quantity;
    totalAmount += price * item.quantity;
    orderItems.push({ product: product._id, quantity: item.quantity, price });
  }

  const discount = Math.floor(totalAmount * (Number(discountPercent) || 0) / 100);

  const [order] = await Order.create([{
    user: userId,
    items: orderItems,
    totalItems,
    totalAmount,
    discount,
    discountCode,
    shippingAddress,
    paymentMethod,
    notes,
    source,
  }], { session });

  const movements = [];
  for (const item of orderItems) {
    // eslint-disable-next-line no-await-in-loop
    const prod = await Product.findById(item.product).lean().session(session);
    const prevQty = prod
      ? (prod.quantity !== undefined && prod.quantity !== null ? prod.quantity : (prod.stock ?? 0))
      : 0;
    const newQty = Math.max(0, prevQty - item.quantity);
    const stockField = (prod && prod.quantity !== undefined && prod.quantity !== null) ? 'quantity' : 'stock';
    // eslint-disable-next-line no-await-in-loop
    await Product.findByIdAndUpdate(item.product, { $inc: { [stockField]: -item.quantity } }, { session });
    movements.push({
      product: item.product, type: 'order', delta: -item.quantity,
      prevQty, newQty, createdBy: userId, orderId: order._id,
    });
  }
  if (movements.length) await StockMovement.insertMany(movements, { session });

  return order;
}

module.exports = { buildOrder };
