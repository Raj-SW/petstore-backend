<!-- Mirror copy. Canonical: docs/superpowers/specs/2026-07-15-vet-spotlight-tips-editorial-design.md -->

# Vet Spotlight + Tips Editorial Index — Design Spec

**Date:** 2026-07-15
**Scope:** Homepage only — rebuild `VetNetworkSection` and `PetCareTipsSection`
(frontend repo). The `/appointments` and `/pet-care-tips` pages keep their
existing card grids. No backend changes.

**Goal:** The homepage currently stacks three card grids (Vet Recommended
products → professionals → tips). Give the two non-product sections distinct,
premium, non-card shapes with rich-but-tasteful motion (no scroll-jacking).

**Design tokens:** Existing GlobalCustomStyle.css vars throughout —
`--color-primary-forest` #001C10, `--color-accent-gold` #D99A2B,
`--color-bg-cream` #FAF5F1, `--color-bg-warm-ivory` #F6ECE3,
`--font-display` (Bebas Neue), `--font-script`, `--font-body` (Poppins).
Easing: `[0.25, 0.46, 0.45, 0.94]` (the house curve).

---

## Part A — Vet Network "Spotlight"

### Files
- Rewrite: `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.css`
- Rewrite: `src/Pages/HomePage/HomePageSections/VetNetworkSection/VetNetworkSection.test.jsx` (exists? create if not)
- Untouched: `ProfessionalCard` component (still used by /appointments).

### Data
Same fetch as today: `professionalsApi.getProfessionals({ limit: 4, sortBy: "professionalInfo.rating", sortOrder: "desc" })`.
Section returns `null` when the list is empty (unchanged). Skeleton while loading
(one spotlight-shaped skeleton block, not 4 cards).

Fields used per professional: `name`, `role`, `specialization`,
`profileImage?.url`, `professionalInfo?.rating` (may be missing),
`professionalInfo?.experience` (years, may be missing), `_id`.

### Layout (desktop ≥1024px)
Full-width band on `--color-primary-forest` background (dark section — it sits
between the ivory Pet Travel band and the cream Tips section, adding rhythm).

- Section header: same pattern as other sections — deco line + paw + line
  (gold), title "Meet Our Veterinary Network" in `--font-display` gold,
  centered.
- Spotlight row, max-width 1100px, grid `minmax(0,320px) minmax(0,1fr)`,
  gap 3rem, min-height 340px (reserve height — no layout shift on switch):
  - **Left — portrait.** 300×340px frame, `border-radius: 150px 150px 16px 16px`
    (arch), 2px gold border with 6px offset ring (`outline`), image
    `object-fit: cover`. **Fallback when `profileImage?.url` is falsy:** same
    arch frame, `#123726` fill, centered initials monogram (first letters of
    first + last name) in `--font-display` gold 64px.
  - **Right — bio.** Stacked:
    1. Eyebrow: `{ROLE LABEL} · ★ {rating}` — role label from the existing
       `ROLE_BADGES` map; rating shown to 1 decimal only when
       `professionalInfo?.rating > 0`, otherwise eyebrow shows role only.
       Gold, 0.72rem, letter-spacing 0.12em, uppercase.
    2. Name: `--font-display`, clamp(2rem, 4vw, 3rem), cream.
    3. Specialization line: `--font-body`, 1rem, muted cream
       (rgba(250,245,241,0.75)). Append `· {experience} yrs experience` when
       present.
    4. CTA row: gold pill button "Book with {firstName}" →
       `navigate(/appointments/professional/{_id})`; ghost link
       "View all professionals →" → `/appointments`.
- **Avatar rail** below the spotlight, centered flex row, gap 0.9rem:
  one 56px round avatar per professional (image or initials disc). Active
  avatar: gold 2px ring (offset 3px) + full opacity; inactive: 55% opacity,
  hover → 100%. Buttons (`aria-label={name}`), `aria-pressed` on active.

### Behavior
- `activeIndex` state. Clicking an avatar sets it.
- Auto-advance: `setInterval` 6000ms → next index (wraps). Paused while the
  pointer is over the spotlight row or rail (`onMouseEnter`/`onMouseLeave`),
  and permanently stopped after the user clicks an avatar (user intent wins).
  Interval cleaned up on unmount. Auto-advance is disabled entirely when
  `prefers-reduced-motion` (via `window.matchMedia`).
- Transition: `AnimatePresence mode="wait"` keyed on `activeIndex`.
  Portrait: opacity 0→1 + scale 0.96→1, 0.35s house ease.
  Bio block: opacity 0→1 + y 12→0, 0.35s, 0.05s delay.
  Exit: opacity→0, 0.2s. (No slide direction logic — crossfade only, YAGNI.)
- Section entrance: header fades down (as today); spotlight row
  `whileInView` opacity 0→1 y 24→0 once.

### Responsive matrix (Part A)
| Range | Layout |
|---|---|
| ≥1024px | Two-column grid as above (320px portrait + bio), rail below |
| 641–1023px (tablet) | Two-column KEPT but tightened: portrait column 240px (frame 220×250, arch radius 110px), gap 2rem, name clamp caps at 2.4rem. Rail below, unchanged |
| ≤640px (phone) | Single column, centered: portrait max-width 220px → bio (centered text) → rail (horizontal, wraps, still 56px — comfortably ≥44px touch targets). CTA buttons full-width stacked |
| ≤380px (small phone) | Same as phone; portrait 180px, name clamp floor 1.7rem, rail avatars 48px |

Tap avatar = switch (same handler); auto-advance still runs until first tap.
All type uses `clamp()` so intermediate widths scale fluidly — breakpoints only
change structure, never cause text jumps.

---

## Part B — Pet Care Tips "Editorial Index"

### Files
- Rewrite: `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.jsx`
- Rewrite: `src/Pages/HomePage/HomePageSections/PetCareTipsSection/PetCareTipsSection.css`
- Create/rewrite test alongside.
- Remove the imports of `TipCard` and `PetCareTips.css` from this section
  (TipCard remains in use on the /pet-care-tips page).

### Data
Same fetch: `tipsApi.getTips({ limit: 3 })`. Empty → section returns `null`.
Fields per tip: `title`, `slug`, `category`, `animalType`, `readTime` (min,
may be missing), `coverImage?.url` (verify actual field name against TipCard
during implementation — use whatever TipCard reads today).

### Layout (desktop ≥1024px)
Cream (`--color-bg-cream`) band.

- Section header: deco + "Pet Care Tips" display title + script subtitle
  "advice from our vets", centered (match the shared section-header pattern).
- Editorial grid, max-width 1100px: `minmax(0,1fr) 340px`, gap 3rem,
  align-items stretch.
  - **Left — numbered index.** One row per tip (all 3 rendered, no hiding):
    - Number `01`-`03`: `--font-display`, 2rem. Active row: gold; inactive:
      #C9BFAE.
    - Title: `--font-body` 600, 1.15rem, forest. Active row: title underlined
      with a 2px gold underline that animates in (CSS `scaleX` 0→1 from left,
      0.25s house ease — no framer needed for this).
    - Meta line: `{ANIMAL} · {CATEGORY} · {readTime} min read`, 0.75rem,
      uppercase, muted. Omit missing pieces.
    - Arrow `→` icon, gold, slides in 6px on active.
    - Rows separated by 1px `#E8E0D2` divider. Whole row is a `<Link>` to
      `/pet-care-tips/{slug}`.
    - Hover/focus a row → it becomes the **active** row (drives the image
      frame). First row active by default. `onFocus` included for keyboard.
  - **Right — image frame.** 340px wide, fills grid height (min 300px),
    `border-radius: 16px`, overflow hidden. Shows active tip's cover image via
    `AnimatePresence mode="wait"` crossfade (opacity + scale 1.04→1, 0.4s).
    Fallback when no image: forest fill with large gold paw icon centered
    (FaPaw, 56px, 0.5 opacity). Below the image inside the frame bottom edge:
    a caption bar (rgba(0,28,16,0.75) backdrop) with the active tip title,
    cream 0.85rem — so the frame is self-explanatory.
- CTA row below grid, centered: existing "View All Articles" pill
  (keep `.pcts-cta-btn` styles) → `/pet-care-tips` (use `<Link>`, not `<a>`).
- Row entrance: staggered `whileInView` (y 18→0, opacity, 0.08s stagger, once).

### Responsive matrix (Part B)
| Range | Layout |
|---|---|
| ≥1024px | Index + 340px image frame as above |
| 768–1023px (tablet) | Index + image frame KEPT; frame narrows to 280px, gap 2rem, row title 1.05rem |
| ≤767px (phone) | Image frame hidden (`display:none`). Rows become: 64×64 rounded thumbnail (cover or paw fallback) · (title + meta) · arrow — numbers dropped. Rows keep dividers; whole row ≥64px tall (touch target). Tap navigates; no active-state logic (it only drove the frame) |
| ≤380px (small phone) | Same as phone; thumbnail 52px, title 0.95rem, meta may wrap to 2 lines |

Row padding and titles use `clamp()`/rem so in-between widths degrade fluidly.

---

## Shared / non-functional

- **Reduced motion:** both sections wrap transitions in the framer defaults;
  auto-advance off under `prefers-reduced-motion` (Part A). Crossfades are
  opacity-only in that case (scale/slide removed via `useReducedMotion()`).
- **No new dependencies.** framer-motion, react-icons, react-router only.
- **Accessibility:** avatar rail = buttons with `aria-label` + `aria-pressed`;
  tip rows = links, focus-visible outlines (2px gold); decorative images
  `alt=""`/`aria-hidden`; portraits `alt={name}`.
- **Performance:** portraits/covers `loading="lazy"` except the initially
  active one; both sections are below the fold so no fetchpriority games.
- **Large screens (≥1440px):** both sections stay capped at max-width 1100px,
  centered — content never stretches on ultrawide monitors.
- **Responsive verification step (part of implementation, not optional):**
  check both sections live in the Browser pane at 1440, 1024, 768, 640, 375
  and 320px widths — no horizontal overflow, touch targets ≥44px, no text
  clipping in the arch frame or index rows.

## Testing (vitest + RTL, framer + APIs mocked per house pattern)

Part A:
1. Fetches with `limit: 4`, rating sort; renders active professional's name,
   role label, and Book CTA.
2. Renders one avatar button per professional; clicking avatar 2 shows
   professional 2's name and marks `aria-pressed`.
3. Missing `profileImage` → initials monogram rendered (query by text, e.g.
   "AR") instead of an `img` in the portrait slot.
4. Missing rating → eyebrow shows role label without "★".
5. Empty API response → section renders nothing.
6. Book CTA navigates to `/appointments/professional/{id}` (mockNavigate).

Part B:
1. Fetches with `limit: 3`; renders all 3 titles as links to
   `/pet-care-tips/{slug}` with numbered 01/02/03 markers.
2. Hovering (mouseEnter) row 2 makes it active — its title appears in the
   image-frame caption.
3. Tip without cover image → paw fallback rendered in frame.
4. Meta line omits readTime when missing.
5. Empty API response → section renders nothing.
6. "View All Articles" links to `/pet-care-tips`.

## Out of scope
- /appointments and /pet-care-tips pages (keep cards).
- ProfessionalCard / TipCard components (still used elsewhere).
- Backend changes, new endpoints, CMS fields (e.g. vet quotes — the bio line
  uses existing specialization/experience data only).
