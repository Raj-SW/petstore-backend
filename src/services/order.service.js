const Order = require('../models/order.model');
const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const StoreSettings = require('../models/storeSettings.model');
const { AppError } = require('../middlewares/errorHandler');

const round2 = (n) => Math.round(n * 100) / 100;

// Compute shipping + tax from the store settings for a given net base amount.
// Inclusive: VAT is already inside prices (broken out for display); grandTotal
// excludes it. Exclusive: VAT is added on top of the base.
function computeChargesFromSettings(base, settings) {
  const shippingFlatFee = Number(settings.shippingFlatFee) || 0;
  const freeShippingThreshold = Number(settings.freeShippingThreshold) || 0;
  const rate = (Number(settings.taxRatePercent) || 0) / 100;
  const taxInclusive = settings.taxInclusive !== false;

  const shippingFee = base >= freeShippingThreshold ? 0 : shippingFlatFee;
  let tax;
  let grandTotal;
  if (taxInclusive) {
    tax = rate > 0 ? round2(base - base / (1 + rate)) : 0;
    grandTotal = round2(base + shippingFee);
  } else {
    tax = round2(base * rate);
    grandTotal = round2(base + tax + shippingFee);
  }
  return { shippingFee, tax, taxRate: Number(settings.taxRatePercent) || 0, taxInclusive, grandTotal };
}

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

    let price;
    let originalPrice;
    let variantLabel = null;
    if (item.variantId && product.hasVariants) {
      const v = product.variants.id(item.variantId);
      if (!v) throw new AppError(`Selected option for ${product.name} is unavailable`, 400);
      if (v.quantity != null && v.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name} (${v.label})`, 400);
      }
      price = product.priceForVariant(item.variantId);
      originalPrice = v.price;
      variantLabel = v.label;
    } else {
      if (product.quantity != null && product.quantity > 0 && product.quantity < item.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }
      price = product.effectivePrice;
      originalPrice = product.price;
    }

    totalItems += item.quantity;
    totalAmount += price * item.quantity;
    orderItems.push({
      product: product._id, quantity: item.quantity, price, originalPrice,
      variantId: item.variantId || null, variantLabel,
    });
  }

  const discount = Math.floor(totalAmount * (Number(discountPercent) || 0) / 100);

  // Shipping + tax from store settings, computed on the post-discount base.
  const settings = await StoreSettings.getSettings();
  const base = totalAmount - discount;
  const charges = computeChargesFromSettings(base, settings);

  const [order] = await Order.create([{
    user: userId,
    items: orderItems,
    totalItems,
    totalAmount,
    discount,
    discountCode,
    shippingFee:  charges.shippingFee,
    tax:          charges.tax,
    taxRate:      charges.taxRate,
    taxInclusive: charges.taxInclusive,
    grandTotal:   charges.grandTotal,
    shippingAddress,
    paymentMethod,
    notes,
    source,
  }], { session });

  const movements = [];
  for (const item of orderItems) {
    // eslint-disable-next-line no-await-in-loop
    const prod = await Product.findById(item.product).session(session);
    let prevQty;
    let newQty;
    if (item.variantId && prod && prod.variants && prod.variants.id(item.variantId)) {
      const v = prod.variants.id(item.variantId);
      prevQty = v.quantity;
      newQty = Math.max(0, prevQty - item.quantity);
      // eslint-disable-next-line no-await-in-loop
      await Product.updateOne(
        { _id: item.product, 'variants._id': item.variantId },
        { $inc: { 'variants.$.quantity': -item.quantity } },
        { session },
      );
    } else {
      prevQty = prod
        ? (prod.quantity !== undefined && prod.quantity !== null ? prod.quantity : (prod.stock ?? 0))
        : 0;
      newQty = Math.max(0, prevQty - item.quantity);
      const stockField = (prod && prod.quantity !== undefined && prod.quantity !== null) ? 'quantity' : 'stock';
      // eslint-disable-next-line no-await-in-loop
      await Product.findByIdAndUpdate(item.product, { $inc: { [stockField]: -item.quantity } }, { session });
    }
    movements.push({
      product: item.product, type: 'order', delta: -item.quantity,
      prevQty, newQty, createdBy: userId, orderId: order._id,
    });
  }
  if (movements.length) await StockMovement.insertMany(movements, { session });

  return order;
}

module.exports = { buildOrder };
