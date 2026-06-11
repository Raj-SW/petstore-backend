# VitalPaws – Feature Changelog

> Maintained by Claude. Updated after every completed task.
> Legend: ✅ Done · 🔄 WIP · 📋 Remaining · ❌ Bug

---

## Subsystem A — Inventory Management
**Started:** 2026-06-03 | **Completed:** 2026-06-03 ✅

### Backend
- ✅ Fix dashboard low-stock bug (`stock` → `quantity`) — `admin.controller.js`
- ✅ Add `isFeatured` field to Product model — `product.model.js`
- ✅ Create `StockMovement` model — `stockMovement.model.js`
- ✅ Hook `createOrder` → write StockMovement records — `order.controller.js`
- ✅ Hook `cancelOrder` → write StockMovement records — `order.controller.js`
- ✅ Create `inventory.controller.js` (getInventory, getLowStock, getMovements, restockProduct, adjustStock)
- ✅ Add inventory routes to `admin.routes.js` — 5 routes under `/admin/inventory`

### Frontend
- ✅ Create `inventoryApi.js` — `src/Services/api/inventoryApi.js`
- ✅ Create `AdminInventory.jsx` + `AdminInventory.css` — `src/Pages/Admin/Inventory/`
- ✅ Add `/admin/inventory` route in `main.jsx`
- ✅ Add Inventory sidebar item (`FiBox`) in `AdminLayout.jsx`
- ✅ Frontend build verified: `✓ 1290 modules, built in 7.81s`

---

## Subsystem B — Invoicing & Transactions
**Started:** 2026-06-03 | **Completed:** 2026-06-03 ✅

### Backend
- ✅ `Counter` model — atomic auto-increment for INV-YYYY-NNNN sequences
- ✅ `Invoice` model — snapshotted line items, issued/refunded status, indexes
- ✅ `Transaction` model — financial ledger entry per payment/refund
- ✅ `invoice.service.js` — generateInvoice() + generatePDF() via pdfkit
- ✅ `invoice.controller.js` — 5 endpoints (list, detail, PDF, generate, customer view)
- ✅ `transaction.controller.js` — 2 endpoints (list, detail)
- ✅ Hook payment.controller.confirmPayment → auto-invoice + transaction (idempotent)
- ✅ Hook payment.controller.processRefund → refund transaction + invoice status update
- ✅ Hook order.controller.updatePaymentStatus → invoice on admin manual complete
- ✅ isAdmin guard added to processRefund endpoint
- ✅ 6 admin routes + 1 customer invoice route registered

### Frontend
- ✅ invoiceApi.js + transactionApi.js service files
- ✅ AdminInvoices.jsx + CSS — stats strip, search/filter, animated table, detail drawer, PDF download
- ✅ AdminTransactions.jsx + CSS — revenue stats, type/method filters, ledger table
- ✅ Sidebar: Invoices (FiFileText) + Transactions (FiCreditCard)
- ✅ Routes wired: /admin/invoices, /admin/transactions
- ✅ Frontend build: 1296 modules, zero errors

---

## Previously Completed (this session)
✅ Admin Products — name column fix, Add-Product button contrast  
✅ AdminProductForm — file upload, PATCH, categories array  
✅ Admin product search — normalize name/title before DataTable  
✅ AdminDashboard — fix `/users` → `/admin/users`, `/appointments` → `/admin/appointments`  
✅ PetShopPage — dark hero with banner, animated category chips, Framer Motion stagger  
✅ IndividualProductItemPage — animated crossfade gallery, stock/category badges  
✅ Services navbar dropdown — desktop hover + mobile accordion  
✅ ServicePage — full rebuild (no Bootstrap, Framer Motion, responsive)  
✅ API Groups A–E — endpoint fixes across all service files  
✅ Checkout flow — CheckoutStepper, CartItem animations, CartCheckoutPage rewrite  
✅ PaymentPage — order summary panel, Stripe form polish  
✅ OrderConfirmedPage — animated SVG checkmark, brand-consistent design  
✅ MyOrdersPage — vibrant status badges, 100vh, cartoon border reverted  
✅ CartoonTheme.css — reverted to original clean design system  
