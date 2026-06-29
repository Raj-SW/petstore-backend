const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');
const { deriveProductFromVariants } = require('../utils/productVariants');
const { toSafeString } = require('../utils/sanitize');

// ── Helpers ───────────────────────────────────────────────────────────

function stockStatus(qty, threshold = 10) {
  if (qty <= 0) return 'out'; // treats negative qty same as zero
  if (qty <= threshold) return 'low';
  return 'in';
}

/**
 * Normalize stock quantity for a lean product document.
 * Legacy products store `stock`; new products store `quantity`.
 */
function resolveQty(p) {
  if (p.quantity !== undefined && p.quantity !== null) return p.quantity;
  if (p.stock !== undefined && p.stock !== null) return p.stock;
  return 0;
}

// Per-product threshold override falls back to the global/query threshold.
function effectiveThreshold(p, globalThreshold) {
  return (p.lowStockThreshold !== undefined && p.lowStockThreshold !== null)
    ? p.lowStockThreshold
    : globalThreshold;
}

// Expand a lean product into one row per variant (variant products) or a single
// product-level row. Each row carries a normalised quantity + stockStatus.
function expandProduct(p, globalThreshold) {
  const thr = effectiveThreshold(p, globalThreshold);
  const { variants, ...rest } = p;
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.map((v) => {
      const qty = Number(v.quantity) || 0;
      return {
        ...rest,
        _id: p._id,
        name: p.name || p.title,
        variantId: v._id,
        variantLabel: v.label,
        price: v.price,
        quantity: qty,
        stockStatus: stockStatus(qty, thr),
        hasVariants: true,
      };
    });
  }
  const qty = resolveQty(p);
  return [{ ...rest, quantity: qty, stockStatus: stockStatus(qty, thr), hasVariants: false }];
}

// ── GET /admin/inventory ─────────────────────────────────────────────
// Query: status (out|low|in), category, search, threshold, page, limit
exports.getInventory = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;
    const threshold = parseInt(req.query.threshold, 10) || 10;

    const filter = {};

    if (req.query.category) {
      const cat = req.query.category;
      filter.$or = [{ categories: cat }, { category: cat }];
    }

    if (req.query.search) {
      const searchClause = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { title: { $regex: req.query.search, $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchClause }];
        delete filter.$or;
      } else {
        filter.$or = searchClause;
      }
    }

    const products = await Product.find(filter).lean().sort({ createdAt: -1 });

    // Expand to per-variant rows (variant products) or product-level rows.
    const expanded = products.flatMap((p) => expandProduct(p, threshold));

    // Summary stats across ALL rows (per variant for variant products)
    const outCount = expanded.filter((r) => r.stockStatus === 'out').length;
    const lowCount = expanded.filter((r) => r.stockStatus === 'low').length;
    const totalValue = expanded.reduce((sum, r) => {
      const qty = Math.max(0, Number(r.quantity) || 0);
      const price = Math.max(0, Number(r.price) || 0);
      return sum + qty * price;
    }, 0);

    const filtered = req.query.status
      ? expanded.filter((r) => r.stockStatus === req.query.status)
      : expanded;

    const total = filtered.length;
    const page_data = filtered.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: page_data,
      stats: {
        total: expanded.length,
        out: outCount,
        low: lowCount,
        in: expanded.length - outCount - lowCount,
        totalValue,
      },
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/low-stock ───────────────────────────────────
// Per-variant low-stock detection for variant products.
exports.getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 10;
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);

    const products = await Product.find({}).lean();
    const rows = products
      .flatMap((p) => expandProduct(p, threshold))
      .filter((r) => r.stockStatus === 'low' || r.stockStatus === 'out')
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, limit);

    res.status(200).json({ success: true, data: rows, threshold });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/:id/movements ───────────────────────────────
// Query: page, limit, variantId (optional)
exports.getMovements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const product = await Product.findById(id).lean();
    if (!product) return next(new AppError('Product not found', 404));

    const query = { product: id };
    const variantId = toSafeString(req.query.variantId);
    if (variantId) query.variantId = variantId;

    const [movements, total] = await Promise.all([
      StockMovement.find(query)
        .populate('createdBy', 'name email')
        .populate('orderId', '_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      product: {
        _id: product._id,
        name: product.name || product.title,
        currentQty: product.quantity ?? product.stock ?? 0,
        variants: Array.isArray(product.variants)
          ? product.variants.map((v) => ({ variantId: v._id, label: v.label, quantity: v.quantity }))
          : [],
      },
      data: movements,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// Shared write path for restock/adjust — variant-aware.
async function applyStockChange({
  id, variantId, computeNewQty, type, note, userId,
}) {
  const raw = await Product.findById(id).lean();
  if (!raw) throw new AppError('Product not found', 404);

  const hasVariants = Array.isArray(raw.variants) && raw.variants.length > 0;

  if (hasVariants) {
    if (!variantId) throw new AppError('Specify a variant for this product', 400);
    const variant = raw.variants.find((v) => String(v._id) === String(variantId));
    if (!variant) throw new AppError('Variant not found', 404);

    const prevQty = Number(variant.quantity) || 0;
    const newQty = computeNewQty(prevQty);
    if (newQty < 0) throw new AppError('Resulting quantity cannot be negative', 400);

    const newVariants = raw.variants.map((v) =>
      (String(v._id) === String(variantId) ? { ...v, quantity: newQty } : v));
    const derived = deriveProductFromVariants(newVariants);

    await Product.findByIdAndUpdate(id, {
      $set: { variants: newVariants, price: derived.price, quantity: derived.quantity },
    });

    await StockMovement.create({
      product: id,
      variantId: variant._id,
      variantLabel: variant.label,
      type,
      delta: newQty - prevQty,
      prevQty,
      newQty,
      note,
      createdBy: userId,
    });

    return {
      productId: id, name: raw.name || raw.title,
      variantId: variant._id, variantLabel: variant.label,
      prevQty, newQty, delta: newQty - prevQty,
    };
  }

  // No variants — product-level
  const prevQty = resolveQty(raw);
  const newQty = computeNewQty(prevQty);
  if (newQty < 0) throw new AppError('Resulting quantity cannot be negative', 400);

  await Product.findByIdAndUpdate(id, { $set: { quantity: newQty } });
  await StockMovement.create({
    product: id, type, delta: newQty - prevQty, prevQty, newQty, note, createdBy: userId,
  });

  return { productId: id, name: raw.name || raw.title, prevQty, newQty, delta: newQty - prevQty };
}

// ── PATCH /admin/inventory/:id/restock ───────────────────────────────
// Body: { units: Number (>0), variantId?, note? }
exports.restockProduct = async (req, res, next) => {
  try {
    const units = parseInt(req.body.units, 10);
    if (!units || units <= 0) {
      return next(new AppError('units must be a positive integer', 400));
    }
    const result = await applyStockChange({
      id: req.params.id,
      variantId: req.body.variantId || null,
      computeNewQty: (prev) => prev + units,
      type: 'restock',
      note: req.body.note?.trim() || '',
      userId: req.user.id,
    });
    return res.status(200).json({ success: true, data: { ...result, unitsAdded: units } });
  } catch (error) {
    return next(error);
  }
};

// ── PATCH /admin/inventory/:id/adjust ────────────────────────────────
// Body: { newQuantity: Number (>=0), variantId?, note (required) }
exports.adjustStock = async (req, res, next) => {
  try {
    const newQty = parseInt(req.body.newQuantity, 10);
    const note = req.body.note?.trim();

    if (newQty == null || Number.isNaN(newQty) || newQty < 0) {
      return next(new AppError('newQuantity must be a non-negative integer', 400));
    }
    if (!note) {
      return next(new AppError('A note is required for manual stock adjustments', 400));
    }

    const result = await applyStockChange({
      id: req.params.id,
      variantId: req.body.variantId || null,
      computeNewQty: () => newQty,
      type: 'adjustment',
      note,
      userId: req.user.id,
    });
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};
