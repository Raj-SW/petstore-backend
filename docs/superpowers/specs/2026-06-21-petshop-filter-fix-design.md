# Pet Shop Filter Fix — Design Spec (Epic 5)

**Date:** 2026-06-21
**Repos:** backend (`petstore-backend`) — `getProducts` + new filter-options endpoint; frontend (`petstore-frontend`) — `PetShopPage.jsx` + `FilterComponent.jsx` + `ProductService`.
**Status:** ✅ Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 5.

## Problem

The Pet Shop side-panel filter doesn't work, and there's a redundant second filter strip after the hero.

Root causes (verified):
1. **Category value mismatch.** `FilterComponent` chips are hardcoded `["Dog","Cat","Bird","Fish","Small Pets","General"]` (capitalized), but `getProducts` does an **exact** `query.categories = { $in: categoryArray }` against stored product category strings (e.g. `"dogs"`, lowercase). `categories=Dog` matches nothing. `ProductService.fetchProductsWithFilters` passes the single category straight through.
2. **Dead rating filter.** The sidebar has a star-rating section and sends `minRating`, but products have **no rating field** (ratings were descoped). It filters nothing.
3. **Limited filters / single category.** Only category (first selected) + price are sent; colors/genders (supported by the backend) aren't exposed.
4. **Redundant strip.** A post-hero `ps-cat-strip` (`QUICK_CATS`) is a second category filter with the same mismatch.

## Decisions (locked in brainstorm)

- Fix category matching via **DB-driven filter options + case-insensitive backend match** (not hardcoded relabeling).
- Sidebar exposes **category + price + colors + genders**; the **rating filter is removed**.
- The **post-hero filter strip is removed** (5b).

## Design

### Backend

- **`getProducts` category match → case-insensitive.** Replace `query.categories = { $in: categoryArray }` with a regex `$in`:
  ```js
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  query.categories = { $in: categoryArray.map((c) => new RegExp(`^${escapeRegex(c)}$`, 'i')) };
  ```
  Colors/genders keep their existing `$in` (genders are an enum; colors come from real values).
- **New public endpoint `GET /api/products/filter-options`** → distinct values present in **active** products:
  ```json
  { "categories": ["dogs","cats",...], "colors": ["black",...], "genders": ["Male","Female","Unisex"] }
  ```
  Implemented with `Product.distinct(...)` (or a small aggregation) scoped to `isActive:true`. Registered before `/:id` (like analytics) to avoid shadowing.

### Frontend

- **`FilterComponent`:** on mount, fetch `/api/products/filter-options`; render **category, colors, genders** as multi-select chip groups (sourced from real data → labels match stored values) + the price min/max inputs. **Remove the rating section** entirely. Track `selectedCategories[]`, `selectedColors[]`, `selectedGenders[]`, `minPrice`, `maxPrice`. `apply()` emits all of them; `clear()` resets all.
- **`PetShopPage.handleApplyFilters`:** accept `{ categories, colors, genders, minPrice, maxPrice }` (arrays) and pass them to `fetchProductsWithFilters`; reset to page 1; keep the loading/empty handling.
- **`ProductService.fetchProductsWithFilters`:** serialize array filters as **repeated query keys** (`categories=a&categories=b`, same for `colors`, `genders`) via `URLSearchParams.append`; map `minPrice`/`maxPrice`; **drop `minRating`/`maxRating`**. The backend already reads these as arrays (`Array.isArray` checks).
- **Remove the post-hero strip (5b):** delete the `ps-cat-strip` / `QUICK_CATS` block from `PetShopPage.jsx`, plus the now-unused `activeCat` state and `handleCategoryClick`. Category filtering lives solely in the sidebar (desktop + mobile drawer, which already reuses `FilterComponent`).

### Filter semantics
Within a type → OR (`$in`); across types → AND (separate query keys). Clear resets to the full list. Pagination respects active filters.

## Testing
Run suites individually.
- **Backend:** `getProducts` category filter matches case-insensitively (`Dogs` finds `dogs`); colors/genders narrow results; combining types ANDs; `filter-options` returns distinct active-product categories/colors/genders.
- **Frontend:** selecting category/color/gender chips (from fetched options) + price returns matching products from the API; multiple within a type OR; Clear resets; the rating section is gone; the post-hero strip is gone.

## Acceptance criteria
- Selecting any sidebar filter (category, price, colors, genders) filters results from the API; category matching is case-insensitive and options are sourced from real product data.
- Multiple selections within a type are OR'd; across types AND'd; Clear resets to the full list; pagination respects active filters.
- The dead rating filter is removed; the post-hero category strip is removed.
- Build + existing/new tests pass.

## Out of scope
- Syncing filter state to the URL for shareable links (optional follow-on).
- Migrating the petshop sort dropdown to `ui/Select` (Epic 2 dropdown work).
