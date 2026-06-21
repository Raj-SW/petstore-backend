# Professional Card Redesign + Appointments Search — Design Spec (Epic 4)

**Date:** 2026-06-21
**Repo:** **frontend** (`petstore-frontend`). Spec lives in backend docs (+ root mirror) for consistency with the other 2026-06-21 brainstorm docs.
**Status:** ✅ Approved design, pending implementation plan.
**Depends on:** Epic 2 (design-system foundation) — `<SearchBar>` generalization, `ui/Select`, `ui/card`, `ui/button`, design tokens. Implement after Epic 2.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 4. Reuses shared SearchBar + `ui/*` primitives (DRY register).

## Problem

- The **professional card** (`src/Components/HelperComponents/ProfessionalCard/ProfessionalCard.jsx`) is built on **react-bootstrap** (`Card`/`Button`), looks dated, and still renders **rating stars** + a full contact block — even though the appointment directory rebuild **descoped reviews/ratings**.
- The **appointments list** (`ProfessionalList.jsx`) does its search with a bootstrap `InputGroup`/`Form.Control` and sort with a `Form.Select` (one of the 17 native-select-ish controls) — it should use the reusable `<SearchBar>` + `ui/Select` (item 4b).

## Current state (from code)

- `ProfessionalCard`: react-bootstrap `Card`; avatar (image or ui-avatars fallback), name, qualifications list, experience, **rating stars**, contact (phone/email/location), "View profile" → `onBook`.
- `ProfessionalList`: fetches by role (`professionalsApi.getProfessionalsByRole`), client-side filter (name/qualifications/specialties) + sort (name/experience/**rating**) + pagination; renders `ProfessionalCard`s; search via bootstrap `InputGroup`, sort via `Form.Select`. `AppointmentPage` provides the 4 role tabs and delegates to `ProfessionalList`.

## Design

### 4a — Redesigned professional card
- Rebuild on the shared **`ui/card`** + **design tokens**; replace the react-bootstrap `Card`/`Button` with `ui/card` + `ui/button`.
- **Content (only):** avatar (image or ui-avatars fallback), name, a **role/specialty chip** (`badgeLabel` + specialty), **experience** ("{n} years experience"), and a primary **"View profile"** button → `/appointments/professional/:id`.
- **Removed:** rating stars; the contact block (phone/email/location) — contact lives on `ProfessionalDetailPage`.
- Responsive grid (1 / 2 / 3 columns by breakpoint), subtle hover elevation, accessible focus. Loading **skeleton** and a tasteful **empty state** (list already has loading/empty; ensure they're token-styled).

### 4b — Reusable search + sort in `ProfessionalList`
- Replace the bootstrap search `InputGroup`/`Form.Control` with the reusable **`<SearchBar onSearch={setSearchQuery} placeholder={config.searchPlaceholder} />`** (Epic 2, local-filter mode — `onSearch` updates the existing `searchQuery` state; no navigation).
- Replace the `Form.Select` sort with **`ui/Select`**. Sort options: **Name (A–Z), Name (Z–A), Most Experienced, Least Experienced**. **Remove the rating sort options** (`rating-desc`/`rating-asc`) and the `rating` sort branch.
- Keep the existing debounce, client-side filter, pagination (`PaginationBar`), results summary, and per-role config.
- Replace remaining react-bootstrap usage in the list (`Container`/`Alert`) with token-styled markup / `ui/*` where straightforward; full bootstrap removal is Epic 2 follow-on.

## Reuse
Consumes the shared `<SearchBar>`, `ui/Select`, `ui/card`, `ui/button`, and tokens from Epic 2. No new shared component; `ProfessionalCard` composes the `ui/card` base.

## Testing
Vitest + RTL where feasible:
- `ProfessionalCard` renders avatar, name, specialty chip, experience, and a "View profile" action → navigates to `/appointments/professional/:id`; **no** rating stars; **no** contact block.
- `ProfessionalList` filters via the reusable `<SearchBar>` (`onSearch`), sorts via `ui/Select` (name/experience only — no rating option), pagination + loading + empty states intact.

## Acceptance criteria
- Professional card is rebuilt on `ui/card` + tokens (no react-bootstrap), showing avatar, name, specialty chip, experience, and "View profile"; **no ratings**, **no contact on the card**; responsive 1/2/3-column grid with loading + empty states.
- Appointments list uses the reusable `<SearchBar>` (local filter) + `ui/Select` sort (name/experience; rating sort removed); existing filter/sort/pagination behavior is preserved.
- Build + existing tests pass.
- Implemented after Epic 2 (shared components available).

## Out of scope
- Reintroducing reviews/ratings.
- Booking/calendar (removed in the directory rebuild).
- Changes to `ProfessionalDetailPage` beyond what shared-component adoption requires.
