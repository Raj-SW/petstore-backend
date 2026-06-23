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

module.exports = { runsInHorizon, predictDemand, productCoverage };
