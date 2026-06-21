const mongoose = require('mongoose');
const Subscription = require('../models/subscription.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { buildOrder } = require('../services/order.service');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const logger = require('../utils/logger');

const { frontendUrl } = require('../config/urls');

const DEFAULT_DISCOUNT = parseInt(process.env.SUBSCRIPTION_DISCOUNT_PERCENT || '10', 10);

const formatMUR = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;

// Advance a date by intervalCount units (day/week) from a base date.
function addInterval(base, unit, count) {
  const d = new Date(base);
  const days = unit === 'week' ? count * 7 : count;
  d.setDate(d.getDate() + days);
  return d;
}

// POST /api/subscriptions — customer creates a recurring order
exports.createSubscription = async (req, res, next) => {
  try {
    const {
      items, shippingAddress, paymentMethod, intervalUnit, intervalCount, source,
    } = req.body;

    const nextRunAt = addInterval(new Date(), intervalUnit, intervalCount);

    const subscription = await Subscription.create({
      user: req.user.id,
      items,
      shippingAddress,
      paymentMethod,
      intervalUnit,
      intervalCount,
      discountPercent: DEFAULT_DISCOUNT,
      status: 'active',
      nextRunAt,
      source,
    });

    res.status(201).json({ status: 'success', data: subscription });
  } catch (err) {
    next(err);
  }
};

// GET /api/subscriptions/mine — caller's subscriptions
exports.getMySubscriptions = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find({ user: req.user.id })
      .populate('items.product', 'name price images')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', data: subscriptions });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/subscriptions/:id — owner pause/resume/skip/edit
exports.updateSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
    if (!subscription) return next(new AppError('Subscription not found', 404));

    const { action, ...updates } = req.body;

    // "skip" pushes the next run one interval forward without other edits.
    if (action === 'skip') {
      subscription.nextRunAt = addInterval(subscription.nextRunAt, subscription.intervalUnit, subscription.intervalCount);
    }

    Object.assign(subscription, updates);
    await subscription.save();

    res.status(200).json({ status: 'success', data: subscription });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/subscriptions/:id — owner soft-cancels
exports.cancelSubscription = async (req, res, next) => {
  try {
    const subscription = await Subscription.findOne({ _id: req.params.id, user: req.user.id });
    if (!subscription) return next(new AppError('Subscription not found', 404));

    subscription.status = 'cancelled';
    await subscription.save();

    res.status(200).json({ status: 'success', data: subscription });
  } catch (err) {
    next(err);
  }
};

// GET /api/subscriptions/admin — admin list (all users)
exports.getSubscriptionsAdmin = async (req, res, next) => {
  try {
    const subscriptions = await Subscription.find()
      .populate('user', 'name email')
      .populate('items.product', 'name price')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', data: subscriptions });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/subscriptions/admin/:id — admin edit
exports.updateSubscriptionAdmin = async (req, res, next) => {
  try {
    const subscription = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!subscription) return next(new AppError('Subscription not found', 404));
    res.status(200).json({ status: 'success', data: subscription });
  } catch (err) {
    next(err);
  }
};

// GET|POST /api/subscriptions/process-due — cron runner (Bearer CRON_SECRET)
exports.processDue = async (req, res, next) => {
  try {
    const now = new Date();
    const due = await Subscription.find({ status: 'active', nextRunAt: { $lte: now } });

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const sub of due) {
      // eslint-disable-next-line no-await-in-loop
      const session = await mongoose.startSession();
      try {
        // eslint-disable-next-line no-loop-func
        await session.withTransaction(async () => {
          // Pre-check stock so an out-of-stock run is a clean "skip" (advance,
          // no order) rather than a hard failure.
          let inStock = true;
          for (const it of sub.items) {
            // eslint-disable-next-line no-await-in-loop
            const product = await Product.findById(it.product).session(session);
            let available = 0;
            if (it.variantId && product && product.variants && product.variants.id(it.variantId)) {
              available = product.variants.id(it.variantId).quantity ?? 0;
            } else if (product && product.quantity != null) {
              available = product.quantity;
            }
            if (!product || available < it.quantity) { inStock = false; break; }
          }

          const fresh = await Subscription.findById(sub._id).session(session);
          fresh.lastRunAt = now;
          fresh.nextRunAt = addInterval(now, sub.intervalUnit, sub.intervalCount);

          if (!inStock) {
            await fresh.save({ session });
            skipped += 1;
            return;
          }

          const order = await buildOrder({
            userId: sub.user,
            items: sub.items.map((i) => ({ product: i.product, variantId: i.variantId || null, quantity: i.quantity })),
            shippingAddress: sub.shippingAddress,
            paymentMethod: sub.paymentMethod,
            notes: 'Recurring subscription order',
            discountPercent: sub.discountPercent,
            source: 'subscription',
            session,
          });

          fresh.createdOrders.push(order._id);
          await fresh.save({ session });
          processed += 1;

          // Notify after the transaction is queued; email is non-critical.
          // eslint-disable-next-line no-use-before-define
          await notifyReorder(sub.user, order).catch((e) => logger.error('Reorder email failed', e));
        });
      } catch (err) {
        failed += 1;
        logger.error('Subscription run failed', { subscription: sub._id, error: err.message });
      } finally {
        session.endSession();
      }
    }

    res.status(200).json({
      status: 'success', processed, skipped, failed,
    });
  } catch (err) {
    next(err);
  }
};

// Build + send the pay-now reorder email for a freshly created order.
async function notifyReorder(userId, order) {
  const user = await User.findById(userId).select('name email');
  if (!user) return;

  const products = await Product.find({ _id: { $in: order.items.map((i) => i.product) } })
    .select('name');
  const nameById = new Map(products.map((p) => [p._id.toString(), p.name]));

  const items = order.items.map((i) => ({
    name: nameById.get(i.product.toString()) || 'Item',
    quantity: i.quantity,
    lineTotal: formatMUR(i.price * i.quantity),
  }));

  await sendEmail({
    to: user.email,
    subject: 'Your VitalPaws reorder is ready',
    template: 'subscription-reorder',
    data: {
      name: user.name,
      items,
      subtotal: formatMUR(order.totalAmount),
      discountLabel: order.discount > 0 ? formatMUR(order.discount) : null,
      total: formatMUR(order.totalAmount - (order.discount || 0)),
      payUrl: frontendUrl('profile/orders'),
    },
  });
}
