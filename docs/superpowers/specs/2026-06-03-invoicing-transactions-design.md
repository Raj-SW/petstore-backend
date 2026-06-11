# Invoicing & Transactions – Design Spec
**Date:** 2026-06-03
**Status:** Approved — proceeding to implementation

---

## Scope

Backend + Frontend for invoice generation (on payment), PDF download, transaction ledger, and admin pages for both. Customer-facing invoice view included.

---

## New Models

### Counter
`backend/src/models/counter.model.js`

Atomic auto-increment for invoice number sequences.
```
_id:  String   // counter name, e.g. "invoice"
seq:  Number   // current value, starts at 0
```

### Invoice
`backend/src/models/invoice.model.js`

One document per paid order. Line items are **snapshotted** at generation time (not live references).
```
invoiceNumber  String   INV-2026-0001  (unique, indexed)
order          ObjectId → Order
user           ObjectId → User
lineItems[]    { name, quantity, unitPrice, total }
subtotal       Number   (order.totalAmount before discount)
discount       Number   (order.discount)
total          Number   (subtotal - discount = final charged)
shippingAddress { street, city, state, country, zipCode }
paymentMethod  String
transactionId  String   (from Stripe/PayPal)
paidAt         Date
status         "issued" | "refunded"
timestamps
```
Indexes: `invoiceNumber`, `order`, `user`, `status`, `paidAt desc`

### Transaction
`backend/src/models/transaction.model.js`

Financial ledger entry — separate from the Order model.
```
order          ObjectId → Order
invoice        ObjectId → Invoice (null for failed payments)
user           ObjectId → User
type           "payment" | "refund"
amount         Number
currency       String   default "USD"
paymentMethod  String
transactionId  String
status         "pending" | "completed" | "failed"
timestamps
```
Indexes: `order`, `user`, `type`, `createdAt desc`

---

## New Service

### InvoiceService
`backend/src/services/invoice.service.js`

Two exported functions consumed by controllers and payment hooks:

**`generateInvoice(order, userId)`**
- Atomically increments the `invoice` counter
- Formats `INV-YYYY-NNNN`
- Populates order items with product names (handles `name` and `title` fields)
- Returns saved Invoice document

**`generatePDF(invoice, user)`**
- Pure function: takes invoice + user objects, returns a `Buffer`
- Uses `pdfkit` — no browser, no Chromium
- Layout: VitalPaws header, bill-to block, items table with alternating rows, totals section, footer

---

## Backend Changes

### Hooks into existing controllers

**`payment.controller.js — confirmPayment`**
After `order.save()` when `paymentResult.status === 'completed'`:
```js
const invoice = await InvoiceService.generateInvoice(order, req.user.id);
await Transaction.create({ order: order._id, invoice: invoice._id, user: req.user.id,
  type: 'payment', amount: order.finalAmount, paymentMethod, transactionId, status: 'completed' });
```

**`payment.controller.js — processRefund`**
After `order.save()` when refund succeeds:
```js
await Invoice.findOneAndUpdate({ order: order._id }, { status: 'refunded' });
await Transaction.create({ order: order._id, user: order.user, type: 'refund',
  amount: order.finalAmount, paymentMethod: order.paymentDetails.paymentMethod,
  transactionId: refundResult.transactionId, status: 'completed' });
```
Also adds `isAdmin` guard (missing from current code).

**`order.controller.js — updatePaymentStatus`**
When `paymentStatus === 'completed'` and no invoice exists yet:
```js
const existing = await Invoice.findOne({ order: order._id });
if (!existing) await InvoiceService.generateInvoice(order, req.user.id);
```

### New: invoice.controller.js
```
getInvoices(req, res)              GET /admin/invoices
  - Filter: status, dateFrom, dateTo, search (invoiceNumber / user email)
  - Paginated (default 20)
  - Populate: user (name, email), order (_id)

getInvoice(req, res)               GET /admin/invoices/:id
  - Full detail: lineItems, shippingAddress, user, order

downloadInvoicePDF(req, res)       GET /admin/invoices/:id/pdf
  - Fetches invoice + user, calls generatePDF()
  - Sets Content-Disposition: attachment; filename=INV-XXXX.pdf
  - Streams Buffer as response

generateInvoiceForOrder(req, res)  POST /admin/invoices/generate/:orderId
  - Validates order paymentStatus === 'completed'
  - Validates no existing invoice for this order
  - Calls InvoiceService.generateInvoice()

getMyInvoice(req, res)             GET /invoices/:id
  - Customer-facing, verifies invoice.user === req.user.id
```

### New: transaction.controller.js
```
getTransactions(req, res)          GET /admin/transactions
  - Filter: type, dateFrom, dateTo, paymentMethod
  - Paginated (default 20)
  - Stats: totalRevenue, totalRefunds, netRevenue
  - Populate: user (name, email), order (_id), invoice (invoiceNumber)

getTransaction(req, res)           GET /admin/transactions/:id
  - Full detail
```

### admin.routes.js additions
```
GET  /admin/invoices                     → getInvoices
GET  /admin/invoices/generate/:orderId   ← NOTE: registered before /:id to avoid shadow
POST /admin/invoices/generate/:orderId   → generateInvoiceForOrder
GET  /admin/invoices/:id                 → getInvoice
GET  /admin/invoices/:id/pdf             → downloadInvoicePDF
GET  /admin/transactions                 → getTransactions
GET  /admin/transactions/:id             → getTransaction
```

### payment.routes.js addition
```
POST /payments/:orderId/refund    → add isAdmin guard
```

---

## Frontend Changes

### New: invoiceApi.js
`src/Services/api/invoiceApi.js`
Thin wrappers: `getInvoices`, `getInvoice`, `generateInvoice`, `downloadInvoicePDF`.

### New: transactionApi.js
`src/Services/api/transactionApi.js`
Thin wrappers: `getTransactions`, `getTransaction`.

### New: AdminInvoices.jsx + AdminInvoices.css
`src/Pages/Admin/Invoices/`

Sections:
1. **Stats strip** (3 cards): Total Invoices · Total Revenue · Refunds
2. **Toolbar**: search (invoice # or customer), status filter, date range
3. **Table**: Invoice # · Customer · Date · Amount · Status badge · Actions (View / PDF)
4. **Detail drawer** (slides from right): full invoice breakdown with line items table

### New: AdminTransactions.jsx + AdminTransactions.css
`src/Pages/Admin/Transactions/`

Sections:
1. **Stats strip** (3 cards): Total Revenue · Total Refunds · Net Revenue
2. **Toolbar**: type filter (All / Payment / Refund), payment method filter, date range
3. **Table**: Date · Customer · Type badge · Amount · Method · Transaction ID · Invoice link

### Updates
- `AdminLayout.jsx` — add Invoices (FiFileText) + Transactions (FiCreditCard) to sidebar
- `main.jsx` — add routes for both pages

---

## Files Created / Modified

### Backend
| File | Action |
|---|---|
| `src/models/counter.model.js` | Create |
| `src/models/invoice.model.js` | Create |
| `src/models/transaction.model.js` | Create |
| `src/services/invoice.service.js` | Create |
| `src/controllers/invoice.controller.js` | Create |
| `src/controllers/transaction.controller.js` | Create |
| `src/controllers/payment.controller.js` | Modify — hook invoice/transaction on confirm + refund, add isAdmin to refund |
| `src/controllers/order.controller.js` | Modify — hook invoice generation when admin marks payment complete |
| `src/routes/admin.routes.js` | Modify — add 7 new routes |
| `src/routes/payment.routes.js` | Modify — add isAdmin to refund route |

### Frontend
| File | Action |
|---|---|
| `src/Services/api/invoiceApi.js` | Create |
| `src/Services/api/transactionApi.js` | Create |
| `src/Pages/Admin/Invoices/AdminInvoices.jsx` | Create |
| `src/Pages/Admin/Invoices/AdminInvoices.css` | Create |
| `src/Pages/Admin/Transactions/AdminTransactions.jsx` | Create |
| `src/Pages/Admin/Transactions/AdminTransactions.css` | Create |
| `src/Components/Admin/AdminLayout.jsx` | Modify — 2 sidebar items |
| `src/main.jsx` | Modify — 2 new routes |
