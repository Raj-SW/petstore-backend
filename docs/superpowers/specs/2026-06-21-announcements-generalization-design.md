# Announcements Generalization — Design Spec (Epic 9b)

**Date:** 2026-06-21
**Repo:** backend (`petstore-backend`) for model/controller/templates; frontend composer (`petstore-frontend`) consumes the API.
**Status:** 🚧 **WIP — brainstorm in progress.** Types + audience model are locked; template strategy, typed-target model shape, and acceptance criteria are still open (paused per user 2026-06-21).
**Backlog:** `docs/BACKLOG-2026-06-21.md` Epic 9b; phase-1 notes in `docs/BACKLOG-2026-06-21-PHASE1-BRAINSTORM.md`. Builds on Epic 9a (`2026-06-21-announcement-email-links-design.md`).

## Goal

Generalize the current `SaleAnnouncement` (hard-wired to `products[]`, single `sale-announcement` template, sent to everyone with `emailPreferences.sales`) into a **typed Announcement** system so admins can announce more than sales.

## Current state (from code)

- `models/saleAnnouncement.model.js`: `{ subject, message, products[], audienceCount, sentCount, failedCount, source: 'inline'|'composer', createdBy, sentAt }`.
- `controllers/announcement.controller.js`: `createAnnouncement` resolves `products`, selects recipients (`role:'customer'`, `emailPreferences.sales != false`), sends `sale-announcement` template per recipient (sequential, per-recipient failures non-fatal), records counts. `unsubscribe` flips `emailPreferences.sales=false` via a token (`makeUnsubscribeToken(userId)` — encodes userId only).
- `models/user.model.js`: `emailPreferences: { sales: Boolean (default true) }`.
- Inline path: AdminProductForm "notify customers" checkbox → creates a `source:'inline'` sale announcement.

## Decisions locked

### 1. Announcement types
Grouped by target:
- **Product types** → target `products[]`: `sale` (existing), `new_product`, `price_drop`, `restock` (back-in-stock).
- **Content types** → target a content document: `new_tip` (ref `PetCareTip`), `new_post` (ref `GalleryPost`).
- **Event** → structured inline fields (no product/content ref): title, date/time, location, description, optional link.
- **General / free-form** → rich body + optional CTA link + label. Catch-all (holiday hours, service launch, newsletter digest, etc.).

### 2. Audience / opt-in — two buckets
- **Promotions** bucket ← `sale`, `new_product`, `price_drop`, `restock`.
- **News** bucket ← `new_tip`, `new_post`, `event`, `general`.
- `user.emailPreferences` evolves `{ sales }` → `{ promotions, news }` (both default `true`). **Migration:** copy existing `sales` → `promotions`; default `news` = `true`.
- Recipients for an announcement = customers whose bucket pref is `!= false`.
- **Unsubscribe must target the bucket**: the unsubscribe token needs to carry the bucket (extend `makeUnsubscribeToken(userId, bucket)`), so the link flips the correct preference. Profile UI exposes both toggles (frontend; the existing "Receive sale & promo emails" toggle maps to Promotions).

## Open questions (to finish before this spec is final)

1. **Email template strategy** — one flexible template with type-driven blocks (recommended; aligns with Epic 10 unification) vs. per-type templates vs. two templates (product-grid vs. article/event/general). *Undecided.*
2. **Typed-target model shape** — single `Announcement` model with `type` + a discriminated target. Proposed shape (to confirm):
   - `type` (enum, the 8 above), `bucket` (derived from type: promotions|news),
   - `subject`, `message`,
   - `products: [ObjectId]` (product types),
   - `contentRef: { kind: 'tip'|'post', id: ObjectId }` (content types),
   - `event: { title, startsAt, endsAt, location, description, link }` (event type),
   - `cta: { label, url }` (general/optional any type),
   - keep `audienceCount/sentCount/failedCount/source/createdBy/sentAt`.
   - Rename `SaleAnnouncement` → `Announcement` (keep model alias / collection migration for history). Per-type validators enforce the right target is present.
3. **Inline path** — the product-form "notify customers" stays `type:'sale'` (or offer `new_product`?). *Confirm.*
4. **Acceptance criteria** — to be written once 1–3 are settled.

## Out of scope
- Scheduling/queued sends (send-now only, as today) — revisit later if needed.
- Restock auto-trigger (a `restock` announcement is admin-composed here, not an automatic back-in-stock notifier) — separate feature.
- Email branding/layout restyle — Epic 10.

## Next step
Resume brainstorming: decide the template strategy (open Q1), confirm the model shape (Q2) and inline behavior (Q3), then lock acceptance criteria and mark this spec final.
