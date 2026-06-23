# Patterns & Reuse Register

Shared components and utilities. Build here once, use everywhere — do not duplicate.

---

## Frontend — Shared Components

| Component | Path | Used by | Props summary |
|-----------|------|---------|---------------|
| `ImageManager` | `src/Components/Admin/ImageManager/ImageManager.jsx` | AdminProductForm (product + variant), AdminFeedback, AdminTipForm, AdminGalleryForm | `value`, `onChange`, `uploadUrl`, `max`, `onError`, `label` |
| `DataTable` | `src/Components/Admin/DataTable/DataTable.jsx` | AdminProducts, AdminOrders, AdminUsers, AdminFeedback | `columns`, `data`, `selectable`, `selectedIds`, `onSelectionChange`, `rowIdKey` |
| `SearchBar` | `src/Components/HelperComponents/SearchBar/` | PetCareTipsPage, PetshopPage | `onSearch` prop; de-coupled from gooey/particles animation; back-compat |
| `Breadcrumb` | `src/Components/HelperComponents/Breadcrumb/` | GalleryPage, GalleryDetailPage, IndividualProductItemPage | `items: [{label, path}]` |
| `ProductPrice` | `src/Components/HelperComponents/Price/ProductPrice.jsx` | Product cards, product detail page | `price`, `salePrice`, `isOnSaleNow` |
| `SaleBadge` | `src/Components/HelperComponents/SaleBadge/` | Product detail, product cards | `percent` |
| `RichTextEditor` | `src/Components/RichText/` | AdminProductForm, AdminTipForm, AdminGalleryForm | `preset`, `value`, `onChange` |
| `RichTextRenderer` | `src/Components/RichText/` | Product detail, tip/gallery detail pages | `content` |
| `SubscribeWidget` | `src/Components/Subscriptions/SubscribeWidget.jsx` | IndividualProductItemPage | `product`, `quantity`, `variantId` |

### Admin CSS classes — reuse, don't reinvent

Global admin modal styles live in `src/Pages/Admin/Admin.css` (or equivalent global admin stylesheet):
- `.admin-modal-backdrop`, `.admin-modal`, `.admin-modal-title`, `.admin-modal-msg`, `.admin-modal-actions`, `.admin-modal-btn.confirm`, `.admin-modal-btn.cancel`
- `.admin-card`, `.admin-page`, `.admin-page-header`, `.admin-page-title`, `.admin-page-subtitle`
- `.admin-input`, `.admin-label`, `.admin-field`, `.admin-required`
- `.admin-save-btn`, `.admin-outline-btn`

---

## Backend — Shared Utilities

| Utility | Path | Purpose |
|---------|------|---------|
| `formatMUR` | `src/utils/currency.js` | Format any number as `Rs 1,234`. **Single source — do not write local copies.** |
| `deriveProductFromVariants` | `src/utils/product.utils.js` | Recomputes product-level `price`, `quantity`, `stockStatus` from variant array. Call after every variant mutation. |
| `uploadImage` | `src/controllers/upload.controller.js` | Single-file Cloudinary upload — returns `{url, publicId}`. Mounted per resource at `POST /api/<resource>/upload-image`. |
| `deleteMultipleFromCloudinary` | `src/utils/cloudinary.js` | Batch delete by publicId array. Best-effort (non-fatal). |
| `parseJsonField` | `src/utils/parseJsonField.js` (or inline in controller) | Safely parse a JSON string from FormData body; returns fallback on error. |
| `makeUnsubscribeToken` | `src/utils/email.utils.js` | Generates a signed, bucket-scoped unsubscribe token: `makeUnsubscribeToken(userId, bucket)`. |
| `urls.js` | `src/config/urls.js` | Resolves `FRONTEND_URL` / `CLIENT_URL` / `VERCEL_FRONTEND_URL` with a startup warning if none set. **All transactional email links go through here.** |

---

## Established Patterns

### Immediate-upload image flow
1. User picks file in `<ImageManager>` → component POSTs to `uploadUrl` → Cloudinary → gets `{url, publicId}` back → appends to `value` array.
2. Parent form holds the ordered array in state.
3. On save: append `imageRefs` as `JSON.stringify(images)` to FormData.
4. Backend: parse `imageRefs`, diff against stored `publicId`s, call `deleteMultipleFromCloudinary` on removed ones, save new refs.

Never go back to deferred multipart (sending raw files on form save). It was abandoned because it cannot be shared across resources.

### Variant image cleanup on product update
The product update controller iterates all variants, collects publicIds that are in the old variant images but absent from the new ones, and batch-deletes them. This includes images from entirely removed variants. See `src/controllers/product.controller.js` `updateProduct`.

### Admin bulk actions
`POST /api/products/bulk` accepts `{ action, ids, options }`. Action enum: `activate | deactivate | feature | unfeature | sale | clearSale | delete`. Frontend: `productsApi.bulkAction(action, ids, options)`. UI: sticky toolbar in `AdminProducts.jsx` that appears on row selection via `DataTable` `selectable` prop.
