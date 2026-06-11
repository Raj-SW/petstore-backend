# Inventory Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack admin inventory system with stock movement logging, low-stock alerts, restock/adjust actions, and an Inventory admin page.

**Architecture:** Backend-first — fix existing bugs, add the StockMovement model, hook it into existing order flows (createOrder/cancelOrder), then build the 5 new inventory endpoints. Frontend follows: API wrapper → AdminInventory page → sidebar + routing. All code follows the existing Express/Mongoose/React patterns in the codebase.

**Tech Stack:** Node.js · Express · Mongoose · MongoDB sessions · React 18 · Framer Motion · Feather Icons (react-icons/fi) · custom CSS (no Bootstrap)

---

## File Map

### Backend — created
| File | Responsibility |
|---|---|
| `backend/src/models/stockMovement.model.js` | StockMovement schema |
| `backend/src/controllers/inventory.controller.js` | 5 inventory endpoints |

### Backend — modified
| File | Change |
|---|---|
| `backend/src/models/product.model.js` | Add `isFeatured` field |
| `backend/src/controllers/order.controller.js` | Log StockMovements in createOrder + cancelOrder |
| `backend/src/controllers/admin.controller.js` | Fix `stock` → `quantity` bug in getDashboardStats |
| `backend/src/routes/admin.routes.js` | Add 5 inventory routes |

### Frontend — created
| File | Responsibility |
|---|---|
| `frontend/src/Services/api/inventoryApi.js` | Thin API wrapper |
| `frontend/src/Pages/Admin/Inventory/AdminInventory.jsx` | Inventory page |
| `frontend/src/Pages/Admin/Inventory/AdminInventory.css` | Page styles |

### Frontend — modified
| File | Change |
|---|---|
| `frontend/src/Components/Admin/AdminLayout.jsx` | Add Inventory sidebar item |
| `frontend/src/main.jsx` | Add `/admin/inventory` route |

---

## Task 1 — Fix dashboard bug + add isFeatured to Product model

**Files:**
- Modify: `backend/src/controllers/admin.controller.js` (line ~59)
- Modify: `backend/src/models/product.model.js`

- [ ] **Step 1.1 — Fix the low-stock query in getDashboardStats**

In `backend/src/controllers/admin.controller.js`, find the `getDashboardStats` function. Replace:
```js
const lowStockProducts = await Product.find({ stock: { $lt: 10 } })
  .select('name stock price')
  .limit(5);
```
With:
```js
const lowStockProducts = await Product.find({ quantity: { $lt: 10 } })
  .select('name quantity price categories images')
  .sort({ quantity: 1 })
  .limit(5);
```

- [ ] **Step 1.2 — Add isFeatured field to Product model**

In `backend/src/models/product.model.js`, add after the `isActive` field:
```js
isFeatured: {
  type: Boolean,
  default: false,
},
```

Also add an index after the existing indexes:
```js
productSchema.index({ isFeatured: 1 });
```

- [ ] **Step 1.3 — Verify backend starts without errors**

```bash
cd "backend"
node -e "require('./src/models/product.model.js'); console.log('Product model OK')"
```
Expected output: `Product model OK`

- [ ] **Step 1.4 — Commit**

```bash
git add backend/src/models/product.model.js backend/src/controllers/admin.controller.js
git commit -m "fix: correct low-stock query field (stock→quantity), add isFeatured to Product"
```

- [ ] **Step 1.5 — Update CHANGELOG**

In `docs/CHANGELOG.md`, mark:
```
✅ Fix dashboard low-stock bug (`stock` → `quantity`)
✅ Add `isFeatured` field to Product model
```

---

## Task 2 — Create StockMovement model

**Files:**
- Create: `backend/src/models/stockMovement.model.js`

- [ ] **Step 2.1 — Create the model file**

Create `backend/src/models/stockMovement.model.js`:
```js
const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    type: {
      type: String,
      enum: ['order', 'cancellation', 'restock', 'adjustment'],
      required: true,
    },
    delta: {
      type: Number,
      required: true,
      // positive = added, negative = removed
    },
    prevQty: {
      type: Number,
      required: true,
      min: 0,
    },
    newQty: {
      type: Number,
      required: true,
      min: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
stockMovementSchema.index({ product: 1, createdAt: -1 });
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ type: 1 });

module.exports =
  mongoose.models.StockMovement ||
  mongoose.model('StockMovement', stockMovementSchema);
```

- [ ] **Step 2.2 — Verify model loads**

```bash
cd "backend"
node -e "require('./src/models/stockMovement.model.js'); console.log('StockMovement model OK')"
```
Expected output: `StockMovement model OK`

- [ ] **Step 2.3 — Commit**

```bash
git add backend/src/models/stockMovement.model.js
git commit -m "feat: add StockMovement model for inventory audit log"
```

- [ ] **Step 2.4 — Update CHANGELOG**

Mark `✅ Create StockMovement model`

---

## Task 3 — Hook createOrder → log StockMovements

**Files:**
- Modify: `backend/src/controllers/order.controller.js`

- [ ] **Step 3.1 — Import StockMovement at the top of order.controller.js**

Add after the existing requires at the top of `backend/src/controllers/order.controller.js`:
```js
const StockMovement = require('../models/stockMovement.model');
```

- [ ] **Step 3.2 — Build stock movement records in createOrder**

Inside `createOrder`, find the loop that decrements stock:
```js
// Update product stock
for (const item of orderItems) {
  await Product.findByIdAndUpdate(
    item.product,
    { $inc: { quantity: -item.quantity } },
    { session },
  );
}
```

Replace it with:
```js
// Update product stock and log movements
const movementDocs = [];
for (const item of orderItems) {
  const prod = await Product.findById(item.product).session(session);
  const prevQty = prod.quantity;
  const newQty = Math.max(0, prevQty - item.quantity);
  await Product.findByIdAndUpdate(
    item.product,
    { $inc: { quantity: -item.quantity } },
    { session },
  );
  movementDocs.push({
    product: item.product,
    type: 'order',
    delta: -item.quantity,
    prevQty,
    newQty,
    createdBy: req.user.id,
    orderId: order[0]._id,
  });
}
await StockMovement.insertMany(movementDocs, { session });
```

- [ ] **Step 3.3 — Verify order.controller.js parses without error**

```bash
cd "backend"
node -e "require('./src/controllers/order.controller.js'); console.log('order.controller OK')"
```
Expected: `order.controller OK`

- [ ] **Step 3.4 — Commit**

```bash
git add backend/src/controllers/order.controller.js
git commit -m "feat: log StockMovement records when an order is created"
```

- [ ] **Step 3.5 — Update CHANGELOG**

Mark `✅ Hook createOrder → write StockMovement records`

---

## Task 4 — Hook cancelOrder → log StockMovements

**Files:**
- Modify: `backend/src/controllers/order.controller.js`

- [ ] **Step 4.1 — Add movement logging to cancelOrder**

Inside `cancelOrder`, find the stock-restore loop:
```js
// Restore product stock
for (const item of order.items) {
  await Product.findByIdAndUpdate(item.product, {
    $inc: { quantity: item.quantity },
  });
}
```

Replace it with:
```js
// Restore product stock and log movements
const cancelMovements = [];
for (const item of order.items) {
  const prod = await Product.findById(item.product);
  const prevQty = prod ? prod.quantity : 0;
  const newQty = prevQty + item.quantity;
  await Product.findByIdAndUpdate(item.product, {
    $inc: { quantity: item.quantity },
  });
  cancelMovements.push({
    product: item.product,
    type: 'cancellation',
    delta: item.quantity,
    prevQty,
    newQty,
    createdBy: req.user.id,
    orderId: order._id,
  });
}
await StockMovement.insertMany(cancelMovements);
```

- [ ] **Step 4.2 — Verify**

```bash
cd "backend"
node -e "require('./src/controllers/order.controller.js'); console.log('OK')"
```

- [ ] **Step 4.3 — Commit**

```bash
git add backend/src/controllers/order.controller.js
git commit -m "feat: log StockMovement records when an order is cancelled"
```

- [ ] **Step 4.4 — Update CHANGELOG**

Mark `✅ Hook cancelOrder → write StockMovement records`

---

## Task 5 — Create inventory.controller.js (5 endpoints)

**Files:**
- Create: `backend/src/controllers/inventory.controller.js`

- [ ] **Step 5.1 — Create the file**

Create `backend/src/controllers/inventory.controller.js`:
```js
const Product = require('../models/product.model');
const StockMovement = require('../models/stockMovement.model');
const { AppError } = require('../middlewares/errorHandler');

// ── Helpers ──────────────────────────────────────────

function stockStatus(qty, threshold = 10) {
  if (qty === 0) return 'out';
  if (qty <= threshold) return 'low';
  return 'in';
}

// ── GET /admin/inventory ─────────────────────────────
// Query params: status (out|low|in), category, search, threshold, page, limit
exports.getInventory = async (req, res, next) => {
  try {
    const page      = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit     = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip      = (page - 1) * limit;
    const threshold = parseInt(req.query.threshold, 10) || 10;

    const filter = {};
    if (req.query.category) filter.categories = req.query.category;
    if (req.query.search)   filter.name = { $regex: req.query.search, $options: 'i' };

    // Status filter must be applied post-query (derived field)
    let products = await Product.find(filter)
      .select('name categories quantity isActive isFeatured images price createdAt')
      .sort({ quantity: 1, name: 1 });

    // Enrich with status and filter
    let enriched = products.map(p => ({
      ...p.toObject(),
      stockStatus: stockStatus(p.quantity, threshold),
    }));

    if (req.query.status) {
      enriched = enriched.filter(p => p.stockStatus === req.query.status);
    }

    const total = enriched.length;
    const page_data = enriched.slice(skip, skip + limit);

    // Summary stats
    const out   = enriched.filter(p => p.stockStatus === 'out').length;
    const low   = enriched.filter(p => p.stockStatus === 'low').length;
    const totalValue = enriched.reduce((sum, p) => sum + p.quantity * p.price, 0);

    res.status(200).json({
      success: true,
      data: page_data,
      stats: { total, out, low, in: total - out - low, totalValue },
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/low-stock ───────────────────
// Query params: threshold (default 10), limit (default 20)
exports.getLowStock = async (req, res, next) => {
  try {
    const threshold = parseInt(req.query.threshold, 10) || 10;
    const limit     = Math.min(100, parseInt(req.query.limit, 10) || 20);

    const products = await Product.find({ quantity: { $lte: threshold } })
      .select('name categories quantity price images isActive')
      .sort({ quantity: 1 })
      .limit(limit);

    res.status(200).json({
      success: true,
      data: products.map(p => ({
        ...p.toObject(),
        stockStatus: stockStatus(p.quantity, threshold),
      })),
      threshold,
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /admin/inventory/:id/movements ───────────────
// Query params: page, limit (default 50)
exports.getMovements = async (req, res, next) => {
  try {
    const { id } = req.params;
    const page    = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit   = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip    = (page - 1) * limit;

    const product = await Product.findById(id).select('name quantity');
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
      product: { _id: product._id, name: product.name, currentQty: product.quantity },
      data: movements,
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /admin/inventory/:id/restock ───────────────
// Body: { units: Number (>0), note?: String }
exports.restockProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const units  = parseInt(req.body.units, 10);
    const note   = req.body.note?.trim() || '';

    if (!units || units <= 0) {
      return next(new AppError('units must be a positive integer', 400));
    }

    const product = await Product.findById(id);
    if (!product) return next(new AppError('Product not found', 404));

    const prevQty = product.quantity;
    const newQty  = prevQty + units;

    product.quantity = newQty;
    await product.save();

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
        productId: id,
        name: product.name,
        prevQty,
        newQty,
        unitsAdded: units,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── PATCH /admin/inventory/:id/adjust ────────────────
// Body: { newQuantity: Number (>=0), note: String (required) }
exports.adjustStock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const newQty = parseInt(req.body.newQuantity, 10);
    const note   = req.body.note?.trim();

    if (newQty == null || isNaN(newQty) || newQty < 0) {
      return next(new AppError('newQuantity must be a non-negative integer', 400));
    }
    if (!note) {
      return next(new AppError('A note is required for manual stock adjustments', 400));
    }

    const product = await Product.findById(id);
    if (!product) return next(new AppError('Product not found', 404));

    const prevQty = product.quantity;
    const delta   = newQty - prevQty;

    product.quantity = newQty;
    await product.save();

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
      data: { productId: id, name: product.name, prevQty, newQty, delta },
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 5.2 — Verify controller loads**

```bash
cd "backend"
node -e "require('./src/controllers/inventory.controller.js'); console.log('inventory.controller OK')"
```
Expected: `inventory.controller OK`

- [ ] **Step 5.3 — Commit**

```bash
git add backend/src/controllers/inventory.controller.js
git commit -m "feat: add inventory controller (getInventory, getLowStock, getMovements, restock, adjust)"
```

- [ ] **Step 5.4 — Update CHANGELOG**

Mark `✅ Create inventory.controller.js`

---

## Task 6 — Wire inventory routes in admin.routes.js

**Files:**
- Modify: `backend/src/routes/admin.routes.js`

- [ ] **Step 6.1 — Import controller + add routes**

In `backend/src/routes/admin.routes.js`:

Add import after the existing controller imports:
```js
const {
  getInventory,
  getLowStock,
  getMovements,
  restockProduct,
  adjustStock,
} = require('../controllers/inventory.controller');
```

Add routes before `module.exports = router`:
```js
// Inventory management routes
// NOTE: /low-stock must be before /:id to avoid route shadowing
router.get('/inventory',              getInventory);
router.get('/inventory/low-stock',    getLowStock);
router.get('/inventory/:id/movements', getMovements);
router.patch('/inventory/:id/restock', restockProduct);
router.patch('/inventory/:id/adjust',  adjustStock);
```

- [ ] **Step 6.2 — Verify backend starts**

```bash
cd "backend"
node -e "require('./src/routes/admin.routes.js'); console.log('admin.routes OK')"
```
Expected: `admin.routes OK`

- [ ] **Step 6.3 — Manual smoke test (requires running server)**

Start the backend then run (replace TOKEN and IDs):
```bash
# List inventory
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/admin/inventory

# Low stock
curl -H "Authorization: Bearer <TOKEN>" http://localhost:5000/api/admin/inventory/low-stock?threshold=20

# Restock a product
curl -X PATCH \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"units":5,"note":"test restock"}' \
  http://localhost:5000/api/admin/inventory/<PRODUCT_ID>/restock
```
Expected: `{ "success": true, "data": { ... } }`

- [ ] **Step 6.4 — Commit**

```bash
git add backend/src/routes/admin.routes.js
git commit -m "feat: register inventory routes on /admin/inventory"
```

- [ ] **Step 6.5 — Update CHANGELOG**

Mark `✅ Add inventory routes to admin.routes.js`

---

## Task 7 — Frontend: inventoryApi.js

**Files:**
- Create: `frontend/src/Services/api/inventoryApi.js`

- [ ] **Step 7.1 — Create the API wrapper**

Create `frontend/src/Services/api/inventoryApi.js`:
```js
import { api } from "../../core/api/apiClient";

const inventoryApi = {
  // GET /admin/inventory
  // params: { page, limit, status, category, search, threshold }
  getInventory: async (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ""))
    ).toString();
    const response = await api.get(`/admin/inventory${qs ? `?${qs}` : ""}`);
    return response.data;
  },

  // GET /admin/inventory/low-stock
  getLowStock: async (threshold = 10) => {
    const response = await api.get(`/admin/inventory/low-stock?threshold=${threshold}`);
    return response.data;
  },

  // GET /admin/inventory/:id/movements
  getMovements: async (productId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    const response = await api.get(
      `/admin/inventory/${productId}/movements${qs ? `?${qs}` : ""}`
    );
    return response.data;
  },

  // PATCH /admin/inventory/:id/restock
  restockProduct: async (productId, units, note = "") => {
    const response = await api.patch(`/admin/inventory/${productId}/restock`, {
      units,
      note,
    });
    return response.data;
  },

  // PATCH /admin/inventory/:id/adjust
  adjustStock: async (productId, newQuantity, note) => {
    const response = await api.patch(`/admin/inventory/${productId}/adjust`, {
      newQuantity,
      note,
    });
    return response.data;
  },
};

export default inventoryApi;
```

- [ ] **Step 7.2 — Commit**

```bash
git add frontend/src/Services/api/inventoryApi.js
git commit -m "feat: add inventoryApi service wrapper"
```

- [ ] **Step 7.3 — Update CHANGELOG**

Mark `✅ Create inventoryApi.js`

---

## Task 8 — Frontend: AdminInventory page

**Files:**
- Create: `frontend/src/Pages/Admin/Inventory/AdminInventory.jsx`
- Create: `frontend/src/Pages/Admin/Inventory/AdminInventory.css`

- [ ] **Step 8.1 — Create AdminInventory.jsx**

Create `frontend/src/Pages/Admin/Inventory/AdminInventory.jsx`:
```jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiBox, FiAlertTriangle, FiXCircle, FiDollarSign,
  FiRefreshCw, FiSliders, FiClock, FiX, FiPlus, FiEdit3,
} from "react-icons/fi";
import inventoryApi from "../../../Services/api/inventoryApi";
import { useToast } from "../../../context/ToastContext";
import "./AdminInventory.css";

const STATUS_OPTS = [
  { value: "",    label: "All Stock" },
  { value: "in",  label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
];

const BADGE = {
  in:  { cls: "inv-badge--in",  label: "In Stock" },
  low: { cls: "inv-badge--low", label: "Low Stock" },
  out: { cls: "inv-badge--out", label: "Out of Stock" },
};

const INITIAL_RESTOCK  = { open: false, product: null, units: "", note: "" };
const INITIAL_ADJUST   = { open: false, product: null, newQty: "", note: "" };
const INITIAL_HISTORY  = { open: false, product: null, movements: [], loading: false };

export default function AdminInventory() {
  const { addToast } = useToast();

  // Data
  const [products, setProducts]   = useState([]);
  const [stats, setStats]         = useState({ total: 0, out: 0, low: 0, in: 0, totalValue: 0 });
  const [loading, setLoading]     = useState(true);

  // Filters
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [threshold, setThreshold] = useState(10);

  // Modals
  const [restock, setRestock]     = useState(INITIAL_RESTOCK);
  const [adjust, setAdjust]       = useState(INITIAL_ADJUST);
  const [history, setHistory]     = useState(INITIAL_HISTORY);
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await inventoryApi.getInventory({
        search:    search   || undefined,
        status:    statusFilter || undefined,
        threshold: threshold !== 10 ? threshold : undefined,
        limit:     200,
      });
      setProducts(res.data || []);
      if (res.stats) setStats(res.stats);
    } catch {
      addToast("Failed to load inventory", "error");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, threshold]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  // ── Restock submit ──
  const handleRestock = async (e) => {
    e.preventDefault();
    const units = parseInt(restock.units, 10);
    if (!units || units <= 0) { addToast("Enter a positive number of units", "error"); return; }
    setSubmitting(true);
    try {
      const res = await inventoryApi.restockProduct(restock.product._id, units, restock.note);
      addToast(`Added ${units} units to ${restock.product.name}`, "success");
      setRestock(INITIAL_RESTOCK);
      fetchInventory();
    } catch (err) {
      addToast(err?.response?.data?.message || "Restock failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Adjust submit ──
  const handleAdjust = async (e) => {
    e.preventDefault();
    const newQty = parseInt(adjust.newQty, 10);
    if (newQty == null || isNaN(newQty) || newQty < 0) { addToast("Enter a valid quantity (≥ 0)", "error"); return; }
    if (!adjust.note.trim()) { addToast("A note is required for adjustments", "error"); return; }
    setSubmitting(true);
    try {
      await inventoryApi.adjustStock(adjust.product._id, newQty, adjust.note);
      addToast(`Stock adjusted to ${newQty} for ${adjust.product.name}`, "success");
      setAdjust(INITIAL_ADJUST);
      fetchInventory();
    } catch (err) {
      addToast(err?.response?.data?.message || "Adjustment failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Open movement history ──
  const openHistory = async (product) => {
    setHistory({ open: true, product, movements: [], loading: true });
    try {
      const res = await inventoryApi.getMovements(product._id);
      setHistory(h => ({ ...h, movements: res.data || [], loading: false }));
    } catch {
      setHistory(h => ({ ...h, loading: false }));
      addToast("Failed to load movement history", "error");
    }
  };

  const productImageUrl = (p) => p.images?.[0]?.url || p.images?.[0] || "https://placehold.co/48x48";

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Header ── */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Inventory</h1>
          <p className="admin-page-subtitle">Monitor stock levels, restock products, and view movement history.</p>
        </div>
        <button className="inv-refresh-btn" onClick={fetchInventory} title="Refresh">
          <FiRefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="inv-stats-strip">
        {[
          { icon: <FiBox />,          label: "Total SKUs",     value: stats.total,           cls: "inv-stat--default" },
          { icon: <FiAlertTriangle />, label: "Low Stock",      value: stats.low,             cls: "inv-stat--warn" },
          { icon: <FiXCircle />,       label: "Out of Stock",   value: stats.out,             cls: "inv-stat--danger" },
          { icon: <FiDollarSign />,    label: "Inventory Value",value: `$${(stats.totalValue || 0).toFixed(2)}`, cls: "inv-stat--success" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            className={`inv-stat ${s.cls}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
          >
            <div className="inv-stat-icon">{s.icon}</div>
            <div>
              <p className="inv-stat-value">{s.value}</p>
              <p className="inv-stat-label">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Toolbar ── */}
      <div className="admin-card inv-toolbar">
        <input
          className="inv-search"
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="inv-select"
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
        >
          {STATUS_OPTS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="inv-threshold">
          <label htmlFor="threshold">Low-stock threshold:</label>
          <input
            id="threshold"
            type="number"
            min={1}
            max={999}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="inv-threshold-input"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <div className="admin-card">
        {loading ? (
          <div className="inv-loading">Loading inventory…</div>
        ) : products.length === 0 ? (
          <div className="inv-empty">No products match your filters.</div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {products.map((p, i) => {
                    const badge = BADGE[p.stockStatus] || BADGE.in;
                    return (
                      <motion.tr
                        key={p._id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.025, 0.3) }}
                      >
                        <td>
                          <div className="inv-product-cell">
                            <img
                              src={productImageUrl(p)}
                              alt={p.name}
                              className="inv-product-img"
                              onError={e => { e.target.src = "https://placehold.co/48x48"; }}
                            />
                            <span className="inv-product-name">{p.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="inv-category">{p.categories?.[0] || "—"}</span>
                        </td>
                        <td>
                          <span className={`inv-qty ${p.stockStatus === "out" ? "inv-qty--zero" : ""}`}>
                            {p.quantity}
                          </span>
                        </td>
                        <td>
                          <span className={`inv-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <div className="inv-actions">
                            <button
                              className="inv-action-btn inv-action-btn--restock"
                              onClick={() => setRestock({ open: true, product: p, units: "", note: "" })}
                              title="Restock"
                            >
                              <FiPlus size={13} /> Restock
                            </button>
                            <button
                              className="inv-action-btn inv-action-btn--adjust"
                              onClick={() => setAdjust({ open: true, product: p, newQty: p.quantity, note: "" })}
                              title="Adjust stock"
                            >
                              <FiEdit3 size={13} /> Adjust
                            </button>
                            <button
                              className="inv-action-btn inv-action-btn--history"
                              onClick={() => openHistory(p)}
                              title="View history"
                            >
                              <FiClock size={13} /> History
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Restock modal ── */}
      <AnimatePresence>
        {restock.open && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRestock(INITIAL_RESTOCK)}
          >
            <motion.div
              className="admin-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="admin-modal-title">Restock — {restock.product?.name}</h3>
              <p className="admin-modal-msg">
                Current stock: <strong>{restock.product?.quantity}</strong> units
              </p>
              <form onSubmit={handleRestock}>
                <div className="inv-modal-field">
                  <label>Units to add <span className="admin-required">*</span></label>
                  <input
                    type="number" min={1} placeholder="e.g. 50"
                    value={restock.units}
                    onChange={e => setRestock(r => ({ ...r, units: e.target.value }))}
                    className="admin-input" required autoFocus
                  />
                </div>
                <div className="inv-modal-field">
                  <label>Note (optional)</label>
                  <input
                    type="text" placeholder="e.g. Monthly supplier delivery"
                    value={restock.note}
                    onChange={e => setRestock(r => ({ ...r, note: e.target.value }))}
                    className="admin-input"
                  />
                </div>
                <div className="admin-modal-actions">
                  <button type="button" className="admin-modal-btn cancel" onClick={() => setRestock(INITIAL_RESTOCK)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-modal-btn confirm inv-confirm-btn" disabled={submitting}>
                    {submitting ? "Saving…" : "Add Stock"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Adjust modal ── */}
      <AnimatePresence>
        {adjust.open && (
          <motion.div
            className="admin-modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setAdjust(INITIAL_ADJUST)}
          >
            <motion.div
              className="admin-modal"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
            >
              <h3 className="admin-modal-title">Adjust Stock — {adjust.product?.name}</h3>
              <p className="admin-modal-msg">
                Current stock: <strong>{adjust.product?.quantity}</strong> units
              </p>
              <form onSubmit={handleAdjust}>
                <div className="inv-modal-field">
                  <label>New quantity <span className="admin-required">*</span></label>
                  <input
                    type="number" min={0}
                    value={adjust.newQty}
                    onChange={e => setAdjust(a => ({ ...a, newQty: e.target.value }))}
                    className="admin-input" required autoFocus
                  />
                </div>
                <div className="inv-modal-field">
                  <label>Reason <span className="admin-required">*</span></label>
                  <input
                    type="text" placeholder="e.g. Damaged goods written off"
                    value={adjust.note}
                    onChange={e => setAdjust(a => ({ ...a, note: e.target.value }))}
                    className="admin-input" required
                  />
                </div>
                <div className="admin-modal-actions">
                  <button type="button" className="admin-modal-btn cancel" onClick={() => setAdjust(INITIAL_ADJUST)}>
                    Cancel
                  </button>
                  <button type="submit" className="admin-modal-btn confirm inv-confirm-btn" disabled={submitting}>
                    {submitting ? "Saving…" : "Save Adjustment"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Movement history drawer ── */}
      <AnimatePresence>
        {history.open && (
          <>
            <motion.div
              className="inv-drawer-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setHistory(INITIAL_HISTORY)}
            />
            <motion.aside
              className="inv-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="inv-drawer-header">
                <div>
                  <h3>Movement History</h3>
                  <p>{history.product?.name}</p>
                </div>
                <button className="inv-drawer-close" onClick={() => setHistory(INITIAL_HISTORY)}>
                  <FiX size={18} />
                </button>
              </div>
              <div className="inv-drawer-body">
                {history.loading ? (
                  <div className="inv-drawer-loading">Loading history…</div>
                ) : history.movements.length === 0 ? (
                  <div className="inv-drawer-empty">No movements recorded yet.</div>
                ) : (
                  <div className="inv-movement-list">
                    {history.movements.map((m, i) => (
                      <div key={m._id} className="inv-movement-item">
                        <div className={`inv-movement-badge inv-movement-badge--${m.type}`}>
                          {m.type}
                        </div>
                        <div className="inv-movement-info">
                          <span className="inv-movement-delta">
                            {m.delta > 0 ? `+${m.delta}` : m.delta} units
                            <span className="inv-movement-qty">({m.prevQty} → {m.newQty})</span>
                          </span>
                          {m.note && <span className="inv-movement-note">{m.note}</span>}
                          <span className="inv-movement-meta">
                            {m.createdBy?.name || "System"} · {new Date(m.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 8.2 — Create AdminInventory.css**

Create `frontend/src/Pages/Admin/Inventory/AdminInventory.css`:
```css
/* ================================================
   Admin Inventory Page
   ================================================ */

/* ── Refresh button ── */
.inv-refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-body);
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.6rem 1.2rem;
  background: transparent;
  border: 1.5px solid #ddd;
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-text-default);
  transition: border-color 0.2s, background 0.2s;
}
.inv-refresh-btn:hover {
  border-color: var(--color-primary-forest);
  background: rgba(0, 28, 16, 0.04);
}

/* ── Stats strip ── */
.inv-stats-strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.inv-stat {
  background: #fff;
  border: 1px solid rgba(0, 28, 16, 0.08);
  border-radius: 16px;
  padding: 1.2rem 1.4rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  box-shadow: 0 2px 10px rgba(0, 28, 16, 0.04);
}

.inv-stat-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.inv-stat--default .inv-stat-icon { background: rgba(0, 28, 16, 0.07); color: var(--color-primary-forest); }
.inv-stat--warn    .inv-stat-icon { background: #fef3c7; color: #d97706; }
.inv-stat--danger  .inv-stat-icon { background: #fee2e2; color: #dc2626; }
.inv-stat--success .inv-stat-icon { background: #dcfce7; color: #16a34a; }

.inv-stat-value {
  font-family: var(--font-body);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-default);
  margin: 0;
  line-height: 1.2;
}

.inv-stat-label {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin: 0;
}

/* ── Toolbar ── */
.inv-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.inv-search {
  flex: 1;
  min-width: 200px;
  font-family: var(--font-body);
  font-size: 0.9rem;
  padding: 0.6rem 1rem;
  border: 1.5px solid #ddd;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.2s;
  background: #fff;
}
.inv-search:focus { border-color: var(--color-accent-gold); }

.inv-select {
  font-family: var(--font-body);
  font-size: 0.88rem;
  padding: 0.6rem 0.9rem;
  border: 1.5px solid #ddd;
  border-radius: 10px;
  outline: none;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s;
}
.inv-select:focus { border-color: var(--color-accent-gold); }

.inv-threshold {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-body);
  font-size: 0.83rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.inv-threshold-input {
  width: 64px;
  padding: 0.55rem 0.65rem;
  font-family: var(--font-body);
  font-size: 0.88rem;
  border: 1.5px solid #ddd;
  border-radius: 8px;
  outline: none;
  text-align: center;
  transition: border-color 0.2s;
}
.inv-threshold-input:focus { border-color: var(--color-accent-gold); }

/* ── Table ── */
.inv-table-wrap { overflow-x: auto; }

.inv-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-body);
  font-size: 0.9rem;
}

.inv-table th {
  text-align: left;
  padding: 0.8rem 1rem;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-muted);
  border-bottom: 2px solid rgba(0, 28, 16, 0.06);
  background: rgba(0, 28, 16, 0.02);
}

.inv-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(0, 28, 16, 0.05);
  color: var(--color-text-default);
  vertical-align: middle;
}

.inv-table tr:hover td { background: rgba(0, 28, 16, 0.015); }

/* Product cell */
.inv-product-cell { display: flex; align-items: center; gap: 0.75rem; }
.inv-product-img {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  border: 1px solid #eee;
  background: var(--color-bg-warm-ivory);
  flex-shrink: 0;
}
.inv-product-name { font-weight: 600; color: var(--color-primary-forest); }

.inv-category {
  font-size: 0.8rem;
  background: rgba(0, 28, 16, 0.06);
  color: var(--color-text-muted);
  padding: 0.18rem 0.65rem;
  border-radius: 20px;
  text-transform: capitalize;
}

.inv-qty { font-weight: 700; font-size: 1rem; color: var(--color-primary-forest); }
.inv-qty--zero { color: #dc2626; }

/* Stock badges */
.inv-badge {
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.22rem 0.75rem;
  border-radius: 20px;
  white-space: nowrap;
}
.inv-badge--in  { background: #dcfce7; color: #16a34a; }
.inv-badge--low { background: #fef3c7; color: #d97706; }
.inv-badge--out { background: #fee2e2; color: #dc2626; }

/* Action buttons */
.inv-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }

.inv-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-family: var(--font-body);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  border: 1.5px solid transparent;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, transform 0.15s;
}
.inv-action-btn:hover { transform: translateY(-1px); }

.inv-action-btn--restock { background: #dcfce7; color: #16a34a; border-color: #bbf7d0; }
.inv-action-btn--restock:hover { background: #bbf7d0; }

.inv-action-btn--adjust { background: #fef3c7; color: #d97706; border-color: #fde68a; }
.inv-action-btn--adjust:hover { background: #fde68a; }

.inv-action-btn--history { background: rgba(0, 28, 16, 0.06); color: var(--color-text-default); border-color: rgba(0, 28, 16, 0.12); }
.inv-action-btn--history:hover { background: rgba(0, 28, 16, 0.10); }

/* Loading / empty */
.inv-loading, .inv-empty {
  text-align: center;
  padding: 3rem 2rem;
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--color-text-muted);
}

/* ── Modal fields ── */
.inv-modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}
.inv-modal-field label {
  font-family: var(--font-body);
  font-size: 0.83rem;
  font-weight: 600;
  color: var(--color-text-default);
}
.inv-confirm-btn { background: var(--color-primary-forest) !important; }
.inv-confirm-btn:hover:not(:disabled) { background: var(--color-accent-gold) !important; color: var(--color-primary-forest) !important; }

/* ── Movement history drawer ── */
.inv-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 28, 16, 0.4);
  z-index: 1500;
}

.inv-drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 90vw;
  max-width: 420px;
  background: #fff;
  z-index: 1600;
  display: flex;
  flex-direction: column;
  box-shadow: -8px 0 40px rgba(0, 0, 0, 0.14);
}

.inv-drawer-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.3rem 1.5rem;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.inv-drawer-header h3 {
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 1.05rem;
  margin: 0 0 0.2rem;
  color: var(--color-primary-forest);
}
.inv-drawer-header p {
  font-family: var(--font-body);
  font-size: 0.82rem;
  color: var(--color-text-muted);
  margin: 0;
}

.inv-drawer-close {
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #555;
  flex-shrink: 0;
  transition: background 0.15s;
}
.inv-drawer-close:hover { background: rgba(0, 0, 0, 0.1); }

.inv-drawer-body { flex: 1; overflow-y: auto; padding: 1.2rem 1.5rem; }

.inv-drawer-loading, .inv-drawer-empty {
  text-align: center;
  padding: 3rem 1rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

/* Movement items */
.inv-movement-list { display: flex; flex-direction: column; gap: 0.75rem; }

.inv-movement-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #f0f0f0;
}

.inv-movement-badge {
  font-family: var(--font-body);
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  text-transform: uppercase;
  flex-shrink: 0;
  margin-top: 2px;
}
.inv-movement-badge--order        { background: #fee2e2; color: #dc2626; }
.inv-movement-badge--cancellation { background: #dcfce7; color: #16a34a; }
.inv-movement-badge--restock      { background: #dbeafe; color: #2563eb; }
.inv-movement-badge--adjustment   { background: #fef3c7; color: #d97706; }

.inv-movement-info { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }

.inv-movement-delta {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-primary-forest);
}
.inv-movement-qty {
  font-family: var(--font-body);
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-left: 0.4rem;
  font-weight: 400;
}
.inv-movement-note {
  font-family: var(--font-body);
  font-size: 0.82rem;
  color: #555;
  font-style: italic;
}
.inv-movement-meta {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .inv-stats-strip { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .inv-stats-strip { grid-template-columns: 1fr 1fr; }
  .inv-toolbar { flex-direction: column; align-items: stretch; }
  .inv-search { min-width: unset; }
}
@media (max-width: 480px) {
  .inv-stats-strip { grid-template-columns: 1fr; }
}
```

- [ ] **Step 8.3 — Commit**

```bash
git add frontend/src/Pages/Admin/Inventory/AdminInventory.jsx frontend/src/Pages/Admin/Inventory/AdminInventory.css
git commit -m "feat: add AdminInventory page with stats, table, restock/adjust modals, history drawer"
```

- [ ] **Step 8.4 — Update CHANGELOG**

Mark `✅ Create AdminInventory.jsx + AdminInventory.css`

---

## Task 9 — Wire route + sidebar

**Files:**
- Modify: `frontend/src/main.jsx`
- Modify: `frontend/src/Components/Admin/AdminLayout.jsx`

- [ ] **Step 9.1 — Add route in main.jsx**

In `frontend/src/main.jsx`, add the import after the AdminProducts import:
```js
import AdminInventory from "./Pages/Admin/Inventory/AdminInventory.jsx";
```

In the admin children array, add after the `products/edit/:id` route:
```js
{
  path: "inventory",
  element: <AdminInventory />,
},
```

- [ ] **Step 9.2 — Add sidebar item in AdminLayout.jsx**

In `frontend/src/Components/Admin/AdminLayout.jsx`, add `FiBox` to the existing import:
```js
import {
  FiHome, FiUsers, FiPackage, FiShoppingCart, FiCalendar,
  FiBarChart2, FiSettings, FiMenu, FiX, FiLogOut, FiUserCheck,
  FiBox,
} from "react-icons/fi";
```

In `menuItems`, add after the Products entry:
```js
{
  title: "Inventory",
  path: "/admin/inventory",
  icon: <FiBox className="menu-icon" />,
},
```

- [ ] **Step 9.3 — Build frontend**

```bash
cd "frontend"
npm run build
```
Expected: `✓ built in X.XXs` with no errors.

- [ ] **Step 9.4 — Commit**

```bash
git add frontend/src/main.jsx frontend/src/Components/Admin/AdminLayout.jsx
git commit -m "feat: wire /admin/inventory route and sidebar nav item"
```

- [ ] **Step 9.5 — Update CHANGELOG**

Mark `✅ Create inventoryApi.js`, `✅ Add /admin/inventory route in main.jsx`, `✅ Add Inventory sidebar item in AdminLayout`

---

## Task 10 — End-to-end verification

- [ ] **Step 10.1 — Start both servers**

```bash
# Terminal 1 — backend
cd "backend" && npm run dev

# Terminal 2 — frontend
cd "frontend" && npm run dev
```

- [ ] **Step 10.2 — Login as admin and navigate to /admin/inventory**

Expected: Inventory page loads, stats strip shows totals, product table renders.

- [ ] **Step 10.3 — Test restock flow**

1. Click "Restock" on any product
2. Enter 5 units + note "Test restock"
3. Click "Add Stock"
Expected: Toast "Added 5 units", table quantity increments by 5.

- [ ] **Step 10.4 — Test adjust flow**

1. Click "Adjust" on a product
2. Set new quantity to 3, note "Test adjustment"
3. Click "Save Adjustment"
Expected: Toast confirms, table quantity updates to 3.

- [ ] **Step 10.5 — Test movement history**

1. Click "History" on the product adjusted in 10.4
Expected: Drawer slides in showing at least 1 movement of type "adjustment" with correct delta.

- [ ] **Step 10.6 — Test low-stock filter**

1. Set threshold to 5
2. Select "Low Stock" from filter dropdown
Expected: Only products with qty 1–5 shown.

- [ ] **Step 10.7 — Test order creates stock movement**

1. Place a test order as a non-admin user
2. Return to admin and check History for one of those products
Expected: A movement of type "order" appears with negative delta matching quantity ordered.

- [ ] **Step 10.8 — Final CHANGELOG update**

Mark all Subsystem A items ✅, add date completed.
Set Subsystem B status: "📋 Ready to start".

---

## Self-Review Notes (ran at plan write time)

**Spec coverage:** All 11 spec requirements covered across Tasks 1–9.

**Placeholder scan:** Clean. All steps include actual code or explicit commands.

**Type consistency:**
- `StockMovement` model fields (`product`, `type`, `delta`, `prevQty`, `newQty`, `note`, `createdBy`, `orderId`) match exactly what `inventory.controller.js` writes.
- `inventoryApi.js` method signatures match the controller routes exactly.
- `AdminInventory.jsx` calls `inventoryApi.getInventory()`, `.restockProduct()`, `.adjustStock()`, `.getMovements()` — all defined in Task 7.
- Frontend route path `"inventory"` matches sidebar `path: "/admin/inventory"` ✅.
