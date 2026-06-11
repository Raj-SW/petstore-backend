# Inventory Management – Design Spec
**Date:** 2026-06-03  
**Status:** Approved — proceeding to implementation

---

## Scope
Backend + Frontend inventory management for the admin panel, including stock movement logging, low-stock alerts, restock actions, and a new Inventory admin page.

---

## Bug Fixes (prerequisite)
1. `admin.controller.getDashboardStats` queries `{ stock: { $lt: 10 } }` — must be `{ quantity: { $lt: 10 } }`
2. `Product` model missing `isFeatured` boolean field — add it

---

## New Model: StockMovement
**File:** `backend/src/models/stockMovement.model.js`

```js
{
  product:   ObjectId → Product (required, indexed)
  type:      enum ['order','cancellation','restock','adjustment'] (required)
  delta:     Number  // +ve = added, -ve = removed (required)
  prevQty:   Number  // snapshot before change (required)
  newQty:    Number  // snapshot after change (required)
  note:      String  // optional admin note
  createdBy: ObjectId → User (required)
  orderId:   ObjectId → Order (optional — set for order/cancellation types)
  timestamps: true
}
```
Indexes: `product`, `createdAt desc`

---

## Backend Changes

### product.model.js
- Add `isFeatured: { type: Boolean, default: false }`

### order.controller.js — createOrder
After stock `$inc` loop, also `StockMovement.insertMany()` for each item:
- `type: 'order'`, `delta: -item.quantity`, `prevQty`, `newQty`, `createdBy: req.user.id`, `orderId: order[0]._id`
- Run inside the existing MongoDB session

### order.controller.js — cancelOrder
After stock `$inc` restore loop, also `StockMovement.insertMany()`:
- `type: 'cancellation'`, `delta: +item.quantity`, `prevQty`, `newQty`, `createdBy: req.user.id`, `orderId`

### New: inventory.controller.js
```
getInventory(req, res)           GET /admin/inventory
  - Paginated, filterable by: status (out|low|in), category, search
  - status derived: out = qty 0, low = qty 1-threshold, in = qty > threshold
  - Returns: product fields + computed status

restockProduct(req, res)         PATCH /admin/inventory/:id/restock
  - Body: { units: Number, note?: String }
  - Validates units > 0
  - Atomic: Product.findByIdAndUpdate $inc quantity
  - Creates StockMovement (type: restock)

adjustStock(req, res)            PATCH /admin/inventory/:id/adjust
  - Body: { newQuantity: Number, note: String (required) }
  - Validates newQuantity >= 0
  - Atomic: set product.quantity = newQuantity
  - Creates StockMovement (type: adjustment, delta = newQty - prevQty)

getMovements(req, res)           GET /admin/inventory/:id/movements
  - Paginated (default 50), sorted -createdAt
  - Populates createdBy (name), orderId

getLowStock(req, res)            GET /admin/inventory/low-stock
  - Query param: threshold (default 10)
  - Returns products where quantity <= threshold, sorted by quantity asc
```

### admin.routes.js — add inventory routes
```
GET    /admin/inventory              → getInventory
GET    /admin/inventory/low-stock    → getLowStock   (registered BEFORE /:id)
GET    /admin/inventory/:id/movements → getMovements
PATCH  /admin/inventory/:id/restock  → restockProduct
PATCH  /admin/inventory/:id/adjust   → adjustStock
```

### admin.controller.js — fix dashboard bug
Change `{ stock: { $lt: 10 } }` → `{ quantity: { $lt: 10 } }`

---

## Frontend Changes

### New: inventoryApi.js
`src/Services/api/inventoryApi.js`
Thin wrapper over the 5 new endpoints.

### New: AdminInventory.jsx + AdminInventory.css
`src/Pages/Admin/Inventory/AdminInventory.jsx`

Sections:
1. **Stats strip** (4 cards): Total SKUs · Low Stock · Out of Stock · Total Inventory Value ($)
2. **Toolbar**: search, category filter, status filter (All / In Stock / Low Stock / Out of Stock)
3. **Inventory table** columns: Image · Name · Category · Qty · Status badge · Last movement · Actions (Restock / Adjust)
4. **Restock modal**: product name, current stock, input units, optional note, submit
5. **Adjust modal**: product name, current stock, new quantity input, required note, submit
6. **Movement history drawer**: slides in from right — shows chronological list of all stock events for selected product

### Update: main.jsx
Add route: `{ path: "inventory", element: <AdminInventory /> }` inside admin children

### Update: AdminLayout sidebar
Add "Inventory" nav item with an icon (e.g. FiBox)

### Update: AdminProductForm
`isFeatured` toggle already exists in the form — no change needed. Backend now stores it.

---

## Files Created / Modified

### Backend
| File | Action |
|---|---|
| `src/models/stockMovement.model.js` | Create |
| `src/models/product.model.js` | Modify — add isFeatured |
| `src/controllers/inventory.controller.js` | Create |
| `src/controllers/order.controller.js` | Modify — add movement logging |
| `src/controllers/admin.controller.js` | Modify — fix stock bug |
| `src/routes/admin.routes.js` | Modify — add inventory routes |

### Frontend
| File | Action |
|---|---|
| `src/Services/api/inventoryApi.js` | Create |
| `src/Pages/Admin/Inventory/AdminInventory.jsx` | Create |
| `src/Pages/Admin/Inventory/AdminInventory.css` | Create |
| `src/Components/Admin/AdminLayout.jsx` | Modify — add sidebar item |
| `src/main.jsx` | Modify — add route |
