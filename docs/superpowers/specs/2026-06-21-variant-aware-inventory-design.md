# Variant-Aware Inventory Management — Design Spec (Epic 14)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — StockMovement/Product models, `inventory.controller`, shared derive util; frontend (`petstore-frontend`) — `AdminInventory.jsx`.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 12 (`subscription.analytics.service.predictDemand`) and Epic 2 (`ui/*`). Reuses `formatMUR` (6c).
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 14.

## Problem

The entire inventory layer is **product-level and silently broken for variant products**:
- `restockProduct`/`adjustStock` write the product's `quantity` directly, but for variant products `quantity` is a **derived roll-up** (`Σ variants[].quantity`, set by the `pre('validate')` hook). So a manual adjust doesn't touch any variant's real stock and is overwritten on the next product save; `variants[].quantity` is never reached.
- `StockMovement` has **no `variantId`**; `getInventory`/`getLowStock`/`getMovements` read product-level `quantity` only.

## Current state (from code)

- `stockMovement.model.js`: `{ product, type (order|cancellation|restock|adjustment), delta, prevQty, newQty, note, createdBy, orderId }` — no variant.
- `inventory.controller.js`: `getInventory` (lists products, normalises legacy `stock`→`quantity`, computes `stockStatus(qty, threshold=10)`), `getLowStock` (product `quantity`/`stock` ≤ threshold), `getMovements({ product })`, `restockProduct` (`$set quantity = prev+units`), `adjustStock` (`$set quantity = newQty`). All product-level.
- `product.model.js`: `variants[{ label, price, quantity }]`; `pre('validate')` derives product `price = min(variants.price)`, `quantity = Σ variants.quantity`. `updateProduct` re-derives in the controller (since `findByIdAndUpdate` skips the hook).

## Decisions (locked in brainstorm)

- **Low-stock threshold:** global default + an optional **per-product `lowStockThreshold`** override.
- **Fold Epic-12 predicted shortfall** into the inventory view (reuse `predictDemand`).

## Design

### Models
- **`StockMovement`** += `variantId` (ObjectId, default `null`) + `variantLabel` (String, default `null`). Index `{ product:1, variantId:1, createdAt:-1 }`. Legacy/product-level moves keep `variantId: null` (no backfill).
- **`Product`** += `lowStockThreshold` (Number, default `null` → falls back to the global threshold). Applies to the product and all its variants.

### Shared util
- **`deriveProductFromVariants(productDoc | fields)`** in `src/utils/` (or product service): given variants, return `{ price: min(variants.price), quantity: Σ variants.quantity }`. **Extract from the duplicated logic in `updateProduct`** and reuse it there and in inventory restock/adjust (DRY).
- **`effectiveThreshold(product, globalThreshold)`** = `product.lowStockThreshold ?? globalThreshold`.

### `inventory.controller` — variant-aware
- **`getInventory`:** for products with variants, **expand to one row per variant** `{ productId, name, variantId, variantLabel, quantity: variant.quantity, price: variant.price, stockStatus: stockStatus(variant.quantity, effectiveThreshold) }`; no-variant products → a single product-level row (as today). Summary stats (`out`/`low`/`in`, `totalValue`) computed **per variant** for variant products (value = `variant.quantity × variant.price`). Status filter applies post-enrichment per row.
- **`getLowStock`:** evaluate **per variant** (`variant.quantity ≤ effectiveThreshold`); report the specific variant `{ productId, name, variantId, variantLabel, quantity }`. No-variant products as today.
- **`getMovements`:** accept optional `?variantId=`; filter `StockMovement.find({ product, ...(variantId && { variantId }) })`; include `variantLabel`. The header shows per-variant current quantities when the product has variants.
- **`restockProduct`:** accept optional `variantId`. If the product **has variants → require `variantId`** (else 400 "specify a variant for this product"); `$inc variants.$.quantity` (positional), then **recompute the roll-up** with `deriveProductFromVariants` and `$set` product `quantity`+`price`. Log a `StockMovement` with `variantId`/`variantLabel`, `prevQty`/`newQty` at the **variant** level. No-variant → product-level (as today).
- **`adjustStock`:** same variant rules — set `variants.$.quantity = newQty` (note required), recompute roll-up, log a variant-scoped movement. No-variant unchanged.
- **Demand integration (Epic 12 reuse):** build the `predictDemand({ horizonDays })` map once (default horizon 30, `?horizon=` overridable) and join into each inventory/low-stock row: `projectedDemand`, `shortfall`, `restockNeeded` for that product+variant key. Makes `getInventory` an "inventory health" view.

### Frontend (`AdminInventory.jsx`)
- Render **per-variant rows** (grouped under their product; product roll-up shown as a parent/summary). Stock-status badges per variant.
- Restock/adjust modal includes a **variant selector** (`ui/Select`) when the product has variants; product-level for the rest.
- Per-variant low-stock view; movements view filterable by variant; a **predicted-demand + shortfall + restock-flag column** (from the Epic-12 join), with a horizon selector (`ui/Select`).
- Per-product `lowStockThreshold` edit (inventory row action or product form). Replace native selects with `ui/Select`.

## Reuse
`deriveProductFromVariants` (shared by `updateProduct` + inventory), `predictDemand` (Epic 12), `ui/*` (Epic 2), `formatMUR` (6c).

## Testing
Run suites individually.
- **StockMovement** stores `variantId`/`variantLabel`.
- **`getInventory`** expands variant products to per-variant rows; per-variant stats; `effectiveThreshold` (per-product override) honored; no-variant output unchanged.
- **`restock`/`adjust`** on a variant product update the correct variant's `quantity`, recompute the roll-up (`quantity = Σ`, `price = min`), and log a variant movement; missing `variantId` for a variant product → 400; no-variant path unchanged.
- **`getLowStock`** flags the specific low variant; **`getMovements`** filters by `variantId`.
- Inventory rows include `predictDemand` shortfall + `restockNeeded`.
- `deriveProductFromVariants` unit-tested; `updateProduct` still derives correctly after the extraction.

## Acceptance criteria
- `StockMovement` records `variantId`/`variantLabel`; the movements view shows and can filter by variant.
- Inventory list shows **per-variant stock** for variant products (product as roll-up), honors a per-product `lowStockThreshold` (else global), and counts summary stats per variant.
- Restock + adjust **target a specific variant** for variant products (variantId required), update that variant's quantity, and recompute the product roll-up; the no-variant flow is unchanged.
- Low-stock detection is per-variant; each row surfaces Epic-12 predicted subscription demand + shortfall + restock-needed flag.
- A shared `deriveProductFromVariants` util backs both the product update and inventory adjust paths (DRY).
- Build + existing/new tests pass.

## Out of scope
- Per-variant low-stock thresholds (per-product override only).
- Automated reordering / purchase orders from shortfalls (future; the data is now present).
- Reworking the order-time stock reservation in `buildOrder` (already variant-aware).
