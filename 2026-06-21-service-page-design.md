<!-- Mirror copy for root-level discovery. Canonical: docs/superpowers/specs/2026-06-21-service-page-design.md — keep both in sync. -->

# Service Page — Card Links + Coming Soon — Design Spec (Epic 3)

**Date:** 2026-06-21
**Repo:** **frontend** (`petstore-frontend`). Spec lives in backend docs (+ root mirror) for consistency with the other 2026-06-21 brainstorm docs.
**Status:** ✅ Approved design, pending implementation plan.
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 3.

## Problem

`src/Pages/ServicePage/ServicePage.jsx` renders 7 service cards from a `SERVICES` array; every card's "Learn More" button navigates to its `href`. Two cards have broken/mismapped links, and there's no affordance for services that aren't actually offered yet:

- **Adoption & Rescue** → `href: '/services'` (links back to the page itself — broken).
- **Boarding** → `href: '/appointments?tab=veterinarians'` (mismapped; there is no boarding category/page).
- The other cards link correctly (verified: `AppointmentPage` reads `?tab=` with valid tabs `veterinarians|groomers|trainers|petTaxi`).

## Decisions (locked in brainstorm)

- **Live services (correct links, keep):**
  - Veterinary Care → `/appointments?tab=veterinarians`
  - Grooming → `/appointments?tab=groomers`
  - Import & Export → `/import-export-service`
- **Coming Soon (no destination yet):** **Boarding, Pet Taxi, Pet Training, Adoption & Rescue.**
- **SearchBar on the Service page: dropped** (item 3c removed — a 7-card static page doesn't need it).

## Design

### Config-driven card status
Add a `status: 'live' | 'coming-soon'` field to each `SERVICES` entry:
- `vet`, `grooming`, `import` → `live` (keep their existing `href`).
- `taxi`, `training`, `adoption`, `boarding` → `coming-soon` (the `href` is ignored/removed).

### `ServiceCard` rendering by status
- **Live** (unchanged): "Learn More" button → `navigate(href)`; full hover/interaction.
- **Coming Soon:**
  - A **"Coming Soon" badge/ribbon** on the card (token-styled).
  - The CTA is **disabled / relabeled "Coming Soon"** — no `onClick` navigation, `aria-disabled="true"`, default cursor, removed hover-advance animation.
  - Card visually **de-emphasized** (e.g., muted overlay / reduced saturation) while still showing the title, description, and feature list.
  - The card **stays in the grid** (communicates the roadmap) — not hidden.

### Styling
Badge + de-emphasis use the design tokens (Epic 2). No new shared component required; this is local to `ServicePage.jsx` / `ServiceCard`.

## Testing
Vitest + RTL where feasible:
- Live cards (`vet`, `grooming`, `import`) navigate to their correct routes on "Learn More".
- Coming-soon cards render the "Coming Soon" badge, have a disabled/relabeled CTA with `aria-disabled`, and do **not** navigate on click.
- No SearchBar is rendered on the page.

## Acceptance criteria
- The 3 live services route to their correct destinations (vet/groomer directory tabs, import-export page).
- The 4 coming-soon services (Boarding, Pet Taxi, Pet Training, Adoption & Rescue) each show a "Coming Soon" badge, are visually distinct, and do not navigate (CTA disabled/relabeled, `aria-disabled`).
- No SearchBar is added to the Service page.
- Build + existing tests pass.

## Out of scope
- Building the actual Boarding / Pet Taxi / Pet Training / Adoption features or pages (these are the "coming soon" placeholders).
- Restyling the Service page beyond the badge/disabled-state treatment.
