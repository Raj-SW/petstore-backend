# Navigation & Layout — Design Spec (Epic 1)

**Date:** 2026-06-21
**Repo:** **frontend** (`petstore-frontend`). Spec lives in backend docs (+ root mirror) for consistency with the other 2026-06-21 brainstorm docs.
**Status:** ✅ Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 1. Reuses the shared `<Breadcrumb>` (DRY register in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`).

## Problems

1. **About Us missing from the navbar.** `/about` route + page exist (and the footer links it), but `NavigationBar.jsx` (`NAV_LINKS` desktop + the mobile menu list) omits it.
2. **Mobile header overflows.** The top bar renders logo + brand text ("VitalPaws / VETERINARY CARE") + `CurrencySelector` + account button (with user name) + cart + hamburger — too many items on small screens.
3. **Breadcrumbs missing on Pet Gallery.** `GalleryPage.jsx` and `GalleryDetailPage.jsx` don't render the shared `<Breadcrumb>` that other pages (e.g. PetShop) use.

## Current state (from code)

- `src/Components/NavigationBar/NavigationBar.jsx`: `NAV_LINKS = [Home, Services(dropdown), Pet Store, Pet Care Tips, Gallery, Contact]`. Right-side `.nav-actions` = `<CurrencySelector/>` + account (user menu or `SignUpDropdown`, with `.nav-user-name`) + `<AddToCart/>` + `.nav-hamburger`. A `.mobile-slide-menu` drawer mirrors the links + account actions but **has no currency selector**.
- `src/Components/HelperComponents/CurrencySelector/CurrencySelector.jsx` driven by shared `src/context/CurrencyContext.jsx`.
- `src/Components/HelperComponents/Breadcrumb/Breadcrumb.jsx` — shared component, `items: [{ label, path }]` (per PetShopPage usage).

## Design

### 1a — About in the navbar
- Add `{ label: "About", href: "/about" }` to `NAV_LINKS`, positioned **between Gallery and Contact**.
- Add the matching `<a href="/about">About</a>` link in the mobile drawer list, between Gallery and Contact.
- Active highlight uses the existing `isActive("/about")` (path `startsWith`).

### 1b — Mobile header overflow
Below the mobile breakpoint (match the existing CSS breakpoint where `.nav-links` already hide):
- **Hide `.nav-brand-text`** (the "VitalPaws / VETERINARY CARE" wordmark); keep `.nav-logo-img`.
- **Hide the top-bar account control** (`.nav-user-wrap` / `SignUpDropdown`) and the top-bar `<CurrencySelector/>` (CSS `display:none` < breakpoint). Account actions already live in the drawer.
- **Add `<CurrencySelector/>` into the drawer** (e.g. in `.mobile-menu-header` or top of `.mobile-menu-content`), shown only on mobile. Because both instances read the shared `CurrencyContext`, they stay in sync. (Two rendered instances with responsive show/hide — simplest; no state duplication.)
- Result mobile top bar: **logo + `<AddToCart/>` + hamburger**.
- Ensure tap targets ≥44px and no horizontal overflow at 360–414px.

### 1c — Gallery breadcrumbs
- `GalleryPage.jsx`: render `<Breadcrumb items={[{label:'Home', path:'/'}, {label:'Gallery'}]} />` (last crumb current, non-link), matching PetShop placement.
- `GalleryDetailPage.jsx`: `<Breadcrumb items={[{label:'Home', path:'/'}, {label:'Gallery', path:'/gallery'}, {label:<post title>}]} />`.
- Reuse the shared component as-is (no changes to `Breadcrumb.jsx`).

## Testing
Vitest + RTL where feasible; responsive behavior verified in the browser preview (FE repo).
- Nav renders an About link (desktop list + mobile drawer); navigates to `/about`; active class on `/about`.
- At a mobile width, the top bar contains only logo + cart + hamburger; the drawer contains the currency selector + account actions; no horizontal scroll.
- `GalleryPage` and `GalleryDetailPage` render the breadcrumb with the correct trail.

## Acceptance criteria
- "About" appears top-level **before Contact** in both the desktop nav and the mobile drawer, routes to `/about`, and shows the active highlight on that route.
- On mobile (< breakpoint) the top bar shows **only logo + cart + hamburger** — wordmark hidden, account + `CurrencySelector` moved into the drawer, no user-name text; no horizontal overflow at 360–414px; tap targets ≥44px.
- The drawer currency selector stays in sync with the rest of the app (shared `CurrencyContext`).
- Pet Gallery list and detail pages render the shared `<Breadcrumb>` (Home / Gallery [/ ‹post title›]) in the app-wide style.
- Build + existing tests pass.

## Out of scope
- Restyling the nav/drawer visuals beyond what these fixes require (broader polish is Epic 2 territory).
- Dropdown component swap (Epic 2).
