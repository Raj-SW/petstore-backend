const Subscription = require('../models/subscription.model');
const Product = require('../models/product.model');

const DAY_MS = 24 * 60 * 60 * 1000;

// Count how many times an active subscription runs within [now, now+horizon].
function runsInHorizon(sub, horizonDays, now = new Date()) {
  if (!sub.nextRunAt) return 0;
  const stepDays = (sub.intervalUnit === 'week' ? 7 : 1) * (sub.intervalCount || 1);
  if (stepDays <= 0) return 0;
  const nowMs = now.getTime();
  const endMs = nowMs + horizonDays * DAY_MS;
  const stepMs = stepDays * DAY_MS;
  let t = new Date(sub.nextRunAt).getTime();
  let count = 0;
  let guard = 0;
  while (t <= endMs && guard < 10000) {
    if (t >= nowMs) count += 1;
    t += stepMs;
    guard += 1;
  }
  return count;
}

/**
 * Variant-aware projected subscription demand vs current stock over a horizon.
 * Excludes paused/cancelled subs; skips are respected (nextRunAt already advanced).
 */
async function predictDemand({ horizonDays = 30, safetyMargin = 0 } = {}) {
  const now = new Date();
  const subs = await Subscription.find({ status: 'active' }).lean();

  // Accumulate demand keyed by product + variant.
  const demand = new Map();
  for (const sub of subs) {
    const runs = runsInHorizon(sub, horizonDays, now);
    if (runs <= 0) continue;
    for (const it of sub.items) {
      const key = `${it.product}::${it.variantId || ''}`;
      const row = demand.get(key) || {
        productId: it.product,
        variantId: it.variantId || null,
        variantLabel: it.variantLabel || null,
        projectedDemand: 0,
        activeSubs: 0,
      };
      row.projectedDemand += (Number(it.quantity) || 0) * runs;
      row.activeSubs += 1;
      demand.set(key, row);
    }
  }

  const productIds = [...new Set([...demand.values()].map((d) => String(d.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).lean();
  const pmap = new Map(products.map((p) => [String(p._id), p]));

  const rows = [];
  for (const d of demand.values()) {
    const p = pmap.get(String(d.productId));
    if (!p) continue;
    let currentStock = 0;
    if (d.variantId && Array.isArray(p.variants)) {
      const v = p.variants.find((vv) => String(vv._id) === String(d.variantId));
      currentStock = v ? Number(v.quantity) || 0 : 0;
    } else {
      currentStock = Number(p.quantity) || 0;
    }
    const shortfall = d.projectedDemand - currentStock;
    rows.push({
      productId: d.productId,
      name: p.name || p.title,
      variantId: d.variantId,
      variantLabel: d.variantLabel,
      currentStock,
      projectedDemand: d.projectedDemand,
      shortfall,
      restockNeeded: d.projectedDemand >= currentStock * (1 + safetyMargin),
      activeSubs: d.activeSubs,
    });
  }

  rows.sort((a, b) => b.shortfall - a.shortfall);

  return {
    horizonDays,
    totalActiveSubscriptions: subs.length,
    productsAtRisk: rows.filter((r) => r.restockNeeded).length,
    rows,
  };
}

/**
 * Map of productId -> { activeSubs, unitsPerCycle } across active subscriptions,
 * for the admin product-list "Subscribed (N)" flag.
 */
async function productCoverage() {
  const subs = await Subscription.find({ status: 'active' }).select('items').lean();
  const map = {};
  for (const sub of subs) {
    const seen = new Set();
    for (const it of sub.items) {
      const pid = String(it.product);
      if (!map[pid]) map[pid] = { activeSubs: 0, unitsPerCycle: 0 };
      map[pid].unitsPerCycle += Number(it.quantity) || 0;
      if (!seen.has(pid)) { map[pid].activeSubs += 1; seen.add(pid); }
    }
  }
  return map;
}

/**
 * Enrich a subscription with computed financials + metadata.
 * `sub.items[].product` must be a populated full product document (so the
 * effectivePrice virtual / priceForVariant method work). `sub.createdOrders`
 * may be populated with { totalAmount, discount, status, createdAt }.
 */
function enrichSubscription(sub) {
  const base = typeof sub.toObject === 'function' ? sub.toObject({ virtuals: true }) : { ...sub };
  const discountPct = Number(sub.discountPercent) || 0;

  let preDiscountTotal = 0;
  for (const it of sub.items || []) {
    const p = it.product;
    if (!p || typeof p === 'string') continue; // unpopulated → skip
    let unit;
    if (it.variantId && typeof p.priceForVariant === 'function') {
      unit = p.priceForVariant(it.variantId);
    } else {
      unit = p.effectivePrice != null ? p.effectivePrice : p.price;
    }
    preDiscountTotal += (Number(unit) || 0) * (Number(it.quantity) || 0);
  }

  const preRounded = Math.round(preDiscountTotal);
  const perCycleTotal = Math.round(preDiscountTotal * (1 - discountPct / 100));
  const savings = preRounded - perCycleTotal;

  const count = Number(sub.intervalCount) || 1;
  const unitLabel = sub.intervalUnit === 'week' ? 'week' : 'day';
  const cadenceLabel = `every ${count} ${unitLabel}${count > 1 ? 's' : ''}`;

  let nextRunInDays = null;
  if (sub.nextRunAt) {
    nextRunInDays = Math.max(0, Math.ceil((new Date(sub.nextRunAt).getTime() - Date.now()) / DAY_MS));
  }

  const orderHistory = (Array.isArray(sub.createdOrders) ? sub.createdOrders : [])
    .filter((o) => o && typeof o === 'object' && o.totalAmount != null)
    .map((o) => ({
      id: o._id,
      date: o.createdAt,
      total: (Number(o.totalAmount) || 0) - (Number(o.discount) || 0),
      status: o.status,
    }));

  return { ...base, perCycleTotal, savings, cadenceLabel, nextRunInDays, orderHistory };
}

module.exports = { runsInHorizon, predictDemand, productCoverage, enrichSubscription };
