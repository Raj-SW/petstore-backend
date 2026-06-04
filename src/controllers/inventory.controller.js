const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');

// ── Helper ────────────────────────────────────────────────────────────

function stockStatus(qty, threshold = 10) {
  if (qty <= 0) return 'out';   // treats negative qty same as zero
  if (qty <= threshold) return 'low';
  return 'in';
}

/**
 * Normalize stock quantity for a lean product document.
 * Legacy products store `stock`; new products store `quantity`.
 * Some products have both (quantity was created by $inc from 0 when an order ran).
 * Prefer `quantity` when it exists, fall back to `stock`, then 0.
 */
function resolveQty(p) {
  if (p.quantity !== undefined && p.quantity !== null) return p.quantity;
  if (p.stock    !== undefined && p.stock    !== null) return p.stock;
  return 0;
}

// ── GET /admin/inventory ─────────────────────────────────────────────
// Query: status (out|low|in), category, search, threshold, page, limit
exports.getInventory = async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit     = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip      = (page - 1) * limit;
    const threshold = parseInt(req.query.threshold, 10) || 10;

    const filter = {};

    // ── Category filter: handle both legacy `category` (string) and new `categories` (array)
    if (req.query.category) {
      const cat = req.query.category;
      filter.$or = [
        { categories: cat },
        { category:   cat },
      ];
    }

    // ── Search: handle both `name` (new) and `title` (legacy)
    if (req.query.search) {
      const searchClause = [
        { name:  { $regex: req.query.search, $options: 'i' } },
        { title: { $regex: req.query.search, $options: 'i' } },
      ];
      if (filter.$or) {
        // Combine category OR + search OR using $and so both conditions must be met
        filter.$and = [
          { $or: filter.$or },
          { $or: searchClause },
        ];
        delete filter.$or;
      } else {
        filter.$or = searchClause;
      }
    }

    // Use .lean() — returns plain objects with ALL document fields,
    // including legacy ones (title, imageUrl, category) stored by old schema versions.
    const products = await Product.find(filter)
      .lean()
      .sort({ createdAt: -1 });

    // Enrich: normalise quantity (legacy `stock` vs new `quantity`) and compute status
    let enriched = products.map(p => {
      const qty = resolveQty(p);
      return {
        ...p,
        quantity:    qty,                            // normalised — always a number
        stockStatus: stockStatus(qty, threshold),
      };
    });

    // Apply status filter post-enrichment (derived field)
    if (req.query.status) {
      enriched = enriched.filter(p => p.stockStatus === req.query.status);
    }

    // Summary stats always across ALL products (not just the filtered subset)
    const allEnriched = req.query.status
      ? products.map(p => {
          const qty = resolveQty(p);
          return { stockStatus: stockStatus(qty, threshold), quantity: qty, price: p.price };
        })
      : enriched;

    const outCount   = allEnriched.filter(p => p.stockStatus === 'out').length;
    const lowCount   = allEnriched.filter(p => p.stockStatus === 'low').length;
    // Guard: floor qty at 0 so negative test-data can't produce negative inventory value
    const totalValue = allEnriched.reduce((sum, p) => {
      const qty   = Math.max(0, Number(p.quantity) || 0);
      const price = Math.max(0, Number(p.price)    || 0);
      return sum + qty * price;
    }, 0);

    const total     = enriched.length;
    const page_data = enriched.slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: page_data,
      stats: {
        total: allEnriched.length,
        out:   outCount,
        low:   lowCount,
        in:    allEnriched.length - outCount - lowCount,
        totalValue,
      },
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/low-stock ───────────────────────────────────
// Query: threshold (default 10), limit (default 20)
exports.getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 10;
    const limit     = Math.min(100, parseInt(req.query.limit, 10) || 20);

    // Query both `quantity` (new schema) and `stock` (legacy field)
    const products = await Product.find({
      $or: [
        { quantity: { $lte: threshold } },
        // Legacy products: `quantity` field doesn't exist, only `stock`
        { quantity: { $exists: false }, stock: { $lte: threshold } },
      ],
    })
      .lean()
      .sort({ quantity: 1, stock: 1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: products.map(p => {
        const qty = resolveQty(p);
        return {
          ...p,            // spread plain lean object (NOT .toObject() — that only works on Mongoose docs)
          quantity: qty,   // normalised
          stockStatus: stockStatus(qty, threshold),
        };
      }),
      threshold,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/:id/movements ───────────────────────────────
// Query: page, limit (default 50)
exports.getMovements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page    = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip    = (page - 1) * limit;

    // Use .lean() so non-schema legacy fields (title, stock) are included
    const product = await Product.findById(id).lean();
    if (!product) return next(new AppError('Product not found', 404));

    const [movements, total] = await Promise.all([
      StockMovement.find({ product: id })
        .populate('createdBy', 'name email')
        .populate('orderId', '_id')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      StockMovement.countDocuments({ product: id }),
    ]);

    res.status(200).json({
      success: true,
      product: {
        _id:        product._id,
        name:       product.name || product.title,      // handle both schema versions
        currentQty: product.quantity ?? product.stock ?? 0,
      },
      data: movements,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /admin/inventory/:id/restock ───────────────────────────────
// Body: { units: Number (>0), note?: String }
exports.restockProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const units   = parseInt(req.body.units, 10);
    const note    = req.body.note?.trim() || '';

    if (!units || units <= 0) {
      return next(new AppError('units must be a positive integer', 400));
    }

    // Use .lean() to get raw MongoDB document including legacy `stock` field
    const raw = await Product.findById(id).lean();
    if (!raw) return next(new AppError('Product not found', 404));

    const prevQty = resolveQty(raw);
    const newQty  = prevQty + units;

    // Always write to the `quantity` field (creates it on legacy docs, updates it on new ones)
    await Product.findByIdAndUpdate(id, { $set: { quantity: newQty } });

    await StockMovement.create({
      product:   id,
      type:      'restock',
      delta:     units,
      prevQty,
      newQty,
      note,
      createdBy: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: {
        productId:  id,
        name:       raw.name || raw.title,
        prevQty,
        newQty,
        unitsAdded: units,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /admin/inventory/:id/adjust ────────────────────────────────
// Body: { newQuantity: Number (>=0), note: String (required) }
exports.adjustStock = async (req, res, next) => {
  try {
    const { id }  = req.params;
    const newQty  = parseInt(req.body.newQuantity, 10);
    const note    = req.body.note?.trim();

    if (newQty == null || isNaN(newQty) || newQty < 0) {
      return next(new AppError('newQuantity must be a non-negative integer', 400));
    }
    if (!note) {
      return next(new AppError('A note is required for manual stock adjustments', 400));
    }

    // Use .lean() to get raw MongoDB document including legacy `stock` field
    const raw = await Product.findById(id).lean();
    if (!raw) return next(new AppError('Product not found', 404));

    const prevQty = resolveQty(raw);
    const delta   = newQty - prevQty;

    // Always write to the `quantity` field (creates it on legacy docs, updates it on new ones)
    await Product.findByIdAndUpdate(id, { $set: { quantity: newQty } });

    await StockMovement.create({
      product:   id,
      type:      'adjustment',
      delta,
      prevQty,
      newQty,
      note,
      createdBy: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: { productId: id, name: raw.name || raw.title, prevQty, newQty, delta },
    });
  } catch (error) {
    next(error);
  }
};
