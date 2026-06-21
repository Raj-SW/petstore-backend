<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-design-system-foundation-design.md — keep both in sync. -->

# Design-System Foundation — Design Spec (Epic 2)

**Date:** 2026-06-21
**Repo:** **frontend** (`petstore-frontend`). Spec lives in the backend docs (with a root mirror) for consistency with the other 2026-06-21 brainstorm docs, but all implementation lands in the frontend repo.
**Status:** Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 2; phase-1 notes in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`.

## Problem

The "ugly, inconsistent UI" is caused by **framework sprawl**, not a missing library:

- Four UI frameworks are installed and used simultaneously: **Ant Design**, **Bootstrap / react-bootstrap**, **PrimeReact**, and **Radix** (`@radix-ui/themes` + several primitives).
- A **shadcn/ui** foundation is half-built in `src/Components/ui/` (`button, card, input, label, tabs, accordion, carousel, separator`) using `class-variance-authority` + `clsx` + `@radix-ui/react-slot` + `@/lib/utils` (`cn`), with **Tailwind 3.4** configured. But it is missing key primitives (Select, Dialog, Popover wrapper, Tooltip), so **17 files still use native `<select>`**.
- **Two competing token themes:** `src/styles/GlobalCustomStyle/GlobalCustomStyle.css` (premium forest-green primary, gold/copper accents, cream backgrounds, status colors, Bebas Neue + Playfair fonts) vs. `src/styles/CartoonTheme.css` (playful coral/teal/sunny).
- **Critical disconnect:** the shadcn components reference shadcn's standard token names (`bg-primary`, `text-primary-foreground`, `border-input`, `ring-ring`, `bg-background`…), but the project's real tokens use different names (`--color-primary`, `--color-accent`…). The half-built system is therefore **not bound to the brand palette**.
- The `SearchBar` is a gimmick (gooey SVG filter, framer-motion mouse-particle tracking) and **hardwired** to `navigate('/petshop?search=')` — not reusable.

## Decisions (locked in brainstorm)

- **Strategy:** finish the existing shadcn/ui in `src/Components/ui/`, bound to the premium tokens; build the missing primitives; migrate all native selects. Do **not** start a greenfield system or adopt `@radix-ui/themes` wholesale.
- **Canonical theme:** **premium forest + gold** (`GlobalCustomStyle.css`). Retire `CartoonTheme.css`.
- **Scope:** foundation **+ migrate all 17 native `<select>`**. Framework removal (antd/bootstrap/primereact) and non-dropdown component migration are **follow-on**, out of scope here.

## Design

### 1. Token binding — the missing link
- Establish `GlobalCustomStyle.css` as the single token source. Remove `CartoonTheme.css` imports; migrate any remaining `--cartoon-*` usages to GlobalCustomStyle equivalents, then delete the file.
- Define the shadcn CSS variables in `:root` mapped to the premium palette, as **HSL triplets** (shadcn/Tailwind expects `hsl(var(--primary))`): `--background, --foreground, --card, --card-foreground, --popover, --popover-foreground, --primary, --primary-foreground, --secondary, --secondary-foreground, --muted, --muted-foreground, --accent, --accent-foreground, --destructive, --destructive-foreground, --border, --input, --ring, --radius`.
  - e.g. `--primary` = forest green (from `--color-primary-forest #001C10`), `--accent` = gold (`--color-accent-gold #D99A2B`), `--background` = cream (`--color-bg-cream #FAF5F1`), `--destructive` = `--color-error #C0392B`, `--ring` = accent.
- Verify `tailwind.config.js` `theme.extend.colors` maps `primary/accent/border/input/ring/...` to `hsl(var(--…))`. Fix any names that don't resolve.
- **Result:** existing `ui/` components and all new primitives render on-brand with no per-component color overrides.

### 2. Build missing primitives (`src/Components/ui/`)
Standard shadcn pattern, token-styled, keyboard-accessible:
- `select.jsx` — Radix Select (`@radix-ui/react-select`): `Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel`. **Install dep.**
- `dialog.jsx` — Radix Dialog (`@radix-ui/react-dialog`). **Install dep.**
- `popover.jsx` — wrapper over the already-installed `@radix-ui/react-popover`.
- `tooltip.jsx` — Radix Tooltip (`@radix-ui/react-tooltip`). **Install dep.**

### 3. Migrate all native `<select>` → `ui/select`
17 files: `Components/Admin/DataTable/DataTable.jsx`, `Components/Subscriptions/SubscribeWidget.jsx`, `Components/UserProfile/PetForm.jsx`, `Pages/Admin/Adverts/AdminAdverts.jsx`, `Pages/Admin/Appointments/AdminAppointments.jsx`, `Pages/Admin/Gallery/AdminGalleryForm.jsx`, `Pages/Admin/Inventory/AdminInventory.jsx`, `Pages/Admin/Invoices/AdminInvoices.jsx`, `Pages/Admin/Orders/AdminOrders.jsx`, `Pages/Admin/Products/AdminProductForm.jsx`, `Pages/Admin/Settings/AdminSettings.jsx`, `Pages/Admin/Tips/AdminTipForm.jsx`, `Pages/Admin/Transactions/AdminTransactions.jsx`, `Pages/Admin/Users/AdminUsers.jsx`, `Pages/CartCheckoutPage/CartCheckOutPage.jsx`, `Pages/MyOrders/MyOrdersPage.jsx`, `Pages/PetShopPage/PetShopPage.jsx`.
- Per file: replace `<select>/<option>` with the `Select` API; map current `value` + `onChange(e.target.value)` to `value` + `onValueChange`. Preserve options, default values, disabled states, and any controlled behavior. No functional change — only the control.

### 4. Generalize SearchBar (item 2c)
- New props: `onSearch(query)` (preferred) and/or `searchPath`/`buildHref(query)` for navigation; keep `placeholder` and optional `showInPages`. **Back-compat:** when no `onSearch`/path is provided, keep the current default (`navigate('/petshop?search=<q>')`) so existing usage is unchanged.
- Remove the gooey filter and mouse-particle animation; keep a clean token-styled input with the lucide `Search` icon, a clear ("×") button, Enter-to-submit, and accessible label. Light, optional focus transition only.
- This component is consumed later by Epics 3 (Service), 4 (Appointments), 8 (Pet Care Tips) — not migrated here, just made reusable.

### 5. RTE image fix (item 2d)
- In `src/Components/RichText/RichTextRenderer.css` (and the editor preview styles): `img { max-width: 100%; height: auto; display: block; border-radius: var(--radius); }`; ensure containers don't cause horizontal scroll on mobile; cap extreme heights if needed (`max-height` + `object-fit`).

### 6. Verification surface
- Add an admin-only `/admin/ui-gallery` route rendering every `ui/` primitive (all variants/sizes/states) + a token swatch board, for visual QA in one place.

## Testing
Vitest + React Testing Library (project already runs vitest):
- `Select` renders options, opens on trigger, fires `onValueChange`, keyboard-navigable.
- `SearchBar` calls `onSearch` with the typed query when provided; falls back to navigation when not; clear button empties input.
- `RichTextRenderer` output constrains `img` (assert the rendered class/style or a computed bound in a jsdom check).
- Build (`vite build`) passes; a smoke render of a couple migrated select pages.

## Acceptance criteria
- One canonical token source (`GlobalCustomStyle.css`, premium forest/gold); `CartoonTheme.css` removed; the shadcn token layer is bound to it so all `ui/` components render on-brand.
- New primitives exist and are on-brand + keyboard-accessible: `Select`, `Dialog`, `Popover`, `Tooltip`.
- Zero native `<select>` remain in `src/`; all 17 migrated to `ui/select` with unchanged behavior.
- `SearchBar` is reusable (callback/target prop), de-gimmicked, token-styled; the existing `/petshop` usage still works.
- Images embedded via the rich-text renderer never overflow their container on mobile or desktop.
- `vite build` and existing vitest suites pass.

## Out of scope (tracked follow-on)
- Removing Ant Design, Bootstrap/react-bootstrap, PrimeReact, and consolidating the 5 icon / 5 calendar libraries.
- Migrating non-dropdown components (buttons, cards, modals across pages) to the `ui/` primitives — done incrementally page-by-page under the Epic 2 umbrella.
- Dark mode (tokens are structured to allow it later).
