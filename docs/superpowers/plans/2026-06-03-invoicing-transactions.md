# Invoicing & Transactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate invoices on payment confirmation, expose an admin invoice/transaction ledger, produce downloadable PDFs via pdfkit.

**Architecture:** Three new Mongoose models (Counter, Invoice, Transaction) + a shared InvoiceService injected as hooks into the existing payment and order controllers. Two new admin frontend pages follow the same pattern as AdminInventory.

**Tech Stack:** Node/Express/Mongoose, pdfkit (new), React 18, Framer Motion, react-icons

---

## File Map

### Backend — Create
| File | Responsibility |
|---|---|
| `src/models/counter.model.js` | Atomic auto-increment for invoice number sequences |
| `src/models/invoice.model.js` | Invoice schema with snapshotted line items |
| `src/models/transaction.model.js` | Financial ledger entry per payment/refund |
| `src/services/invoice.service.js` | `generateInvoice()` + `generatePDF()` — shared logic used by controllers |
| `src/controllers/invoice.controller.js` | 5 handler functions for invoice routes |
| `src/controllers/transaction.controller.js` | 2 handler functions for transaction routes |

### Backend — Modify
| File | Change |
|---|---|
| `src/controllers/payment.controller.js` | Hook invoice+transaction creation after confirm; hook refund transaction; add isAdmin guard to processRefund |
| `src/controllers/order.controller.js` | Hook invoice generation when admin marks paymentStatus=completed |
| `src/routes/admin.routes.js` | Add 7 new routes (invoices + transactions) |
| `src/routes/payment.routes.js` | Add isAdmin guard to refund route |

### Frontend — Create
| File | Responsibility |
|---|---|
| `src/Services/api/invoiceApi.js` | Thin wrappers for invoice endpoints |
| `src/Services/api/transactionApi.js` | Thin wrappers for transaction endpoints |
| `src/Pages/Admin/Invoices/AdminInvoices.jsx` | Admin invoice list + detail drawer |
| `src/Pages/Admin/Invoices/AdminInvoices.css` | Invoice page styles |
| `src/Pages/Admin/Transactions/AdminTransactions.jsx` | Transaction ledger page |
| `src/Pages/Admin/Transactions/AdminTransactions.css` | Transaction page styles |

### Frontend — Modify
| File | Change |
|---|---|
| `src/Components/Admin/AdminLayout.jsx` | Add Invoices + Transactions sidebar items |
| `src/main.jsx` | Add 2 new admin routes |

---

## Task 1: Install pdfkit

**Files:**
- Modify: `backend/package.json`

- [ ] **Step 1: Install the package**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\backend"
npm install pdfkit
```

Expected output: `added 1 package` (or similar), no errors.

- [ ] **Step 2: Verify install**

```bash
node -e "const PDFDocument = require('pdfkit'); console.log('pdfkit ok', typeof PDFDocument)"
```

Expected: `pdfkit ok function`

---

## Task 2: Counter Model

**Files:**
- Create: `backend/src/models/counter.model.js`

- [ ] **Step 1: Create the file**

```js
// backend/src/models/counter.model.js
const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id:  { type: String, required: true },   // counter name e.g. 'invoice'
  seq:  { type: Number, default: 0 },
});

module.exports =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);
```

- [ ] **Step 2: Manual smoke-test in Node REPL**

In a separate terminal (backend running):
```bash
node -e "
require('dotenv').config({ path: 'src/config/.env' });
const mongoose = require('mongoose');
const Counter = require('./src/models/counter.model');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const c = await Counter.findByIdAndUpdate('invoice', { \$inc: { seq: 1 } }, { new: true, upsert: true });
  console.log('counter:', c);
  await mongoose.disconnect();
});
"
```

Expected: `counter: { _id: 'invoice', seq: 1, ... }`

---

## Task 3: Invoice Model

**Files:**
- Create: `backend/src/models/invoice.model.js`

- [ ] **Step 1: Create the file**

```js
// backend/src/models/invoice.model.js
const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  quantity:   { type: Number, required: true },
  unitPrice:  { type: Number, required: true },
  total:      { type: Number, required: true },
}, { _id: false });

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    order:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order',  required: true },
    user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',   required: true },
    lineItems:  [lineItemSchema],
    subtotal:   { type: Number, required: true },
    discount:   { type: Number, default: 0 },
    total:      { type: Number, required: true },
    shippingAddress: {
      street:  String,
      city:    String,
      state:   String,
      country: String,
      zipCode: String,
    },
    paymentMethod:  { type: String },
    transactionId:  { type: String },
    paidAt:         { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['issued', 'refunded'],
      default: 'issued',
    },
  },
  { timestamps: true }
);

invoiceSchema.index({ invoiceNumber: 1 });
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ user: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ paidAt: -1 });

module.exports =
  mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
```

---

## Task 4: Transaction Model

**Files:**
- Create: `backend/src/models/transaction.model.js`

- [ ] **Step 1: Create the file**

```js
// backend/src/models/transaction.model.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    order:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order',   required: true },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    type: {
      type: String,
      enum: ['payment', 'refund'],
      required: true,
    },
    amount:        { type: Number, required: true },
    currency:      { type: String, default: 'USD' },
    paymentMethod: { type: String },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'completed',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ order: 1 });
transactionSchema.index({ user: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
```

---

## Task 5: InvoiceService (core business logic + PDF)

**Files:**
- Create: `backend/src/services/invoice.service.js`

- [ ] **Step 1: Create the service**

```js
// backend/src/services/invoice.service.js
const PDFDocument = require('pdfkit');
const Counter     = require('../models/counter.model');
const Invoice     = require('../models/invoice.model');
const Order       = require('../models/order.model');

// ── Generate and persist an Invoice for a completed order ──────────────
async function generateInvoice(orderId, userId) {
  // Atomically get next invoice number
  const year    = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    'invoice',
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  const invoiceNumber = `INV-${year}-${String(counter.seq).padStart(4, '0')}`;

  // Populate order for line item names; handle legacy `title` vs `name`
  const order = await Order.findById(orderId)
    .populate('items.product', 'name title price');

  if (!order) throw new Error(`Order ${orderId} not found`);

  const lineItems = order.items.map((item) => {
    const productName = item.product?.name || item.product?.title || 'Product';
    return {
      name:      productName,
      quantity:  item.quantity,
      unitPrice: item.price,
      total:     item.price * item.quantity,
    };
  });

  const subtotal = order.totalAmount;
  const discount = order.discount || 0;
  const total    = typeof order.finalAmount === 'number'
    ? order.finalAmount
    : subtotal - discount;

  const invoice = await Invoice.create({
    invoiceNumber,
    order:    order._id,
    user:     userId,
    lineItems,
    subtotal,
    discount,
    total,
    shippingAddress: order.shippingAddress,
    paymentMethod:   order.paymentDetails?.paymentMethod || order.paymentMethod,
    transactionId:   order.paymentDetails?.transactionId,
    paidAt:          order.paymentDetails?.paymentDate || new Date(),
    status:          'issued',
  });

  return invoice;
}

// ── Generate a PDF Buffer for an invoice ────────────────────────────────
function generatePDF(invoice, user) {
  return new Promise((resolve, reject) => {
    const doc     = new PDFDocument({ margin: 50, size: 'A4' });
    const buffers = [];
    doc.on('data',  (chunk) => buffers.push(chunk));
    doc.on('end',   ()      => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const BRAND   = '#1a1a2e';
    const MUTED   = '#666666';
    const LIGHT   = '#f8f9fa';
    const BORDER  = '#e2e8f0';
    const RED     = '#e53e3e';
    const WHITE   = '#ffffff';

    // ── Header ────────────────────────────────────────────────────
    doc.fontSize(26).fillColor(BRAND).text('VitalPaws', 50, 45);
    doc.fontSize(9).fillColor(MUTED).text('Premium Pet Care', 50, 78);
    doc.fontSize(22).fillColor(BRAND).text('INVOICE', { align: 'right' });
    doc.moveUp();
    doc.fontSize(10).fillColor(MUTED)
      .text(invoice.invoiceNumber, 50, 83, { align: 'right' });

    // Divider
    doc.moveTo(50, 100).lineTo(545, 100).strokeColor(BORDER).stroke();

    // ── Addresses ─────────────────────────────────────────────────
    doc.fontSize(9).fillColor(BRAND).text('BILL TO', 50, 115);
    doc.fillColor('#333')
      .text(user.name || 'Customer', 50, 130)
      .text(user.email || '', 50, 143);

    const addr = invoice.shippingAddress || {};
    doc.text(`${addr.street || ''}`, 50, 158);
    doc.text(`${addr.city || ''}, ${addr.state || ''} ${addr.zipCode || ''}`, 50, 171);
    doc.text(addr.country || '', 50, 184);

    doc.fontSize(9).fillColor(BRAND).text('INVOICE DATE', 370, 115);
    doc.fillColor('#333')
      .text(new Date(invoice.paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), 370, 130);
    doc.fillColor(BRAND).text('PAYMENT METHOD', 370, 150);
    doc.fillColor('#333').text((invoice.paymentMethod || 'N/A').replace('_', ' '), 370, 165);
    doc.fillColor(BRAND).text('STATUS', 370, 185);
    doc.fillColor(invoice.status === 'refunded' ? RED : '#38a169')
      .text(invoice.status.toUpperCase(), 370, 200);

    // ── Items Table ────────────────────────────────────────────────
    const TABLE_TOP = 230;

    // Header row
    doc.rect(50, TABLE_TOP, 495, 22).fill(BRAND);
    doc.fontSize(8).fillColor(WHITE)
      .text('ITEM',       60,  TABLE_TOP + 7, { width: 230 })
      .text('QTY',       300,  TABLE_TOP + 7, { width: 60,  align: 'right' })
      .text('UNIT PRICE', 370, TABLE_TOP + 7, { width: 85,  align: 'right' })
      .text('TOTAL',     460,  TABLE_TOP + 7, { width: 75,  align: 'right' });

    let y = TABLE_TOP + 28;
    invoice.lineItems.forEach((item, i) => {
      if (i % 2 === 1) doc.rect(50, y - 4, 495, 22).fill(LIGHT);
      doc.fontSize(9).fillColor('#333')
        .text(item.name,                       60,  y, { width: 230 })
        .text(String(item.quantity),          300,  y, { width: 60,  align: 'right' })
        .text(`$${item.unitPrice.toFixed(2)}`, 370, y, { width: 85,  align: 'right' })
        .text(`$${item.total.toFixed(2)}`,    460,  y, { width: 75,  align: 'right' });
      y += 22;
    });

    // ── Totals ────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
    y += 12;

    if (invoice.discount > 0) {
      doc.fontSize(9).fillColor('#555')
        .text('Subtotal:',  350, y, { width: 100 })
        .text(`$${invoice.subtotal.toFixed(2)}`, 460, y, { width: 75, align: 'right' });
      y += 18;
      doc.fillColor(RED)
        .text('Discount:',  350, y, { width: 100 })
        .text(`-$${invoice.discount.toFixed(2)}`, 460, y, { width: 75, align: 'right' });
      y += 18;
      doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
      y += 10;
    }

    doc.fontSize(13).fillColor(BRAND)
      .text('TOTAL:',              350, y, { width: 100 })
      .text(`$${invoice.total.toFixed(2)}`, 460, y, { width: 75, align: 'right' });

    // ── Footer ────────────────────────────────────────────────────
    doc.fontSize(8).fillColor(MUTED)
      .text('Thank you for shopping with VitalPaws! For support contact support@vitalpaws.com',
            50, 720, { align: 'center', width: 495 })
      .text(`Transaction ID: ${invoice.transactionId || 'N/A'}`,
            50, 735, { align: 'center', width: 495 });

    doc.end();
  });
}

module.exports = { generateInvoice, generatePDF };
```

- [ ] **Step 2: Quick smoke test**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\backend"
node -e "const s = require('./src/services/invoice.service'); console.log('exports:', Object.keys(s));"
```

Expected: `exports: [ 'generateInvoice', 'generatePDF' ]`

---

## Task 6: Invoice Controller

**Files:**
- Create: `backend/src/controllers/invoice.controller.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/invoice.controller.js
const Invoice        = require('../models/invoice.model');
const Transaction    = require('../models/transaction.model');
const Order          = require('../models/order.model');
const User           = require('../models/user.model');
const { generateInvoice, generatePDF } = require('../services/invoice.service');
const { AppError }   = require('../middlewares/errorHandler');

// ── GET /admin/invoices ──────────────────────────────────────────────
exports.getInvoices = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.paidAt = {};
      if (req.query.dateFrom) filter.paidAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo)   filter.paidAt.$lte = new Date(req.query.dateTo);
    }

    // Search by invoice number (prefix match)
    if (req.query.search) {
      filter.invoiceNumber = { $regex: req.query.search, $options: 'i' };
    }

    const [invoices, total] = await Promise.all([
      Invoice.find(filter)
        .populate('user',  'name email')
        .populate('order', '_id status')
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit),
      Invoice.countDocuments(filter),
    ]);

    // Stats across ALL invoices (no filter)
    const [allStats] = await Invoice.aggregate([
      { $group: {
        _id: null,
        totalIssued:   { $sum: 1 },
        totalRevenue:  { $sum: { $cond: [{ $eq: ['$status', 'issued']   }, '$total', 0] } },
        totalRefunded: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$total', 0] } },
      }},
    ]);

    res.status(200).json({
      success: true,
      data: invoices,
      stats: allStats || { totalIssued: 0, totalRevenue: 0, totalRefunded: 0 },
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) { next(err); }
};

// ── GET /admin/invoices/:id ──────────────────────────────────────────
exports.getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('user',  'name email')
      .populate('order', '_id status totalAmount discount paymentDetails');
    if (!invoice) return next(new AppError('Invoice not found', 404));
    res.status(200).json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ── GET /admin/invoices/:id/pdf ──────────────────────────────────────
exports.downloadInvoicePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('user', 'name email');
    if (!invoice) return next(new AppError('Invoice not found', 404));

    const pdfBuffer = await generatePDF(invoice, invoice.user || {});

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      'Content-Length':      pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) { next(err); }
};

// ── POST /admin/invoices/generate/:orderId ───────────────────────────
exports.generateInvoiceForOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return next(new AppError('Order not found', 404));
    if (order.paymentStatus !== 'completed') {
      return next(new AppError('Order payment must be completed before generating an invoice', 400));
    }

    const existing = await Invoice.findOne({ order: orderId });
    if (existing) {
      return res.status(200).json({ success: true, data: existing, alreadyExisted: true });
    }

    const invoice = await generateInvoice(orderId, order.user);
    res.status(201).json({ success: true, data: invoice });
  } catch (err) { next(err); }
};

// ── GET /invoices/:id (customer-facing) ─────────────────────────────
exports.getMyInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('user',  'name email')
      .populate('order', '_id status');
    if (!invoice) return next(new AppError('Invoice not found', 404));

    if (invoice.user._id.toString() !== req.user.id) {
      return next(new AppError('Not authorised to view this invoice', 403));
    }
    res.status(200).json({ success: true, data: invoice });
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node -e "require('./src/controllers/invoice.controller'); console.log('invoice controller ok')"
```

Expected: `invoice controller ok`

---

## Task 7: Transaction Controller

**Files:**
- Create: `backend/src/controllers/transaction.controller.js`

- [ ] **Step 1: Create the controller**

```js
// backend/src/controllers/transaction.controller.js
const Transaction  = require('../models/transaction.model');
const { AppError } = require('../middlewares/errorHandler');

// ── GET /admin/transactions ──────────────────────────────────────────
exports.getTransactions = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.type)          filter.type          = req.query.type;
    if (req.query.paymentMethod) filter.paymentMethod = req.query.paymentMethod;
    if (req.query.status)        filter.status        = req.query.status;
    if (req.query.dateFrom || req.query.dateTo) {
      filter.createdAt = {};
      if (req.query.dateFrom) filter.createdAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo)   filter.createdAt.$lte = new Date(req.query.dateTo);
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user',    'name email')
        .populate('order',   '_id status')
        .populate('invoice', 'invoiceNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter),
    ]);

    // Revenue stats (all-time, not just current page/filter)
    const [stats] = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: {
        _id: null,
        totalRevenue:  { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } },
        totalRefunds:  { $sum: { $cond: [{ $eq: ['$type', 'refund']  }, '$amount', 0] } },
        totalCount:    { $sum: 1 },
      }},
    ]);

    const s          = stats || { totalRevenue: 0, totalRefunds: 0, totalCount: 0 };
    s.netRevenue     = s.totalRevenue - s.totalRefunds;

    res.status(200).json({
      success: true,
      data: transactions,
      stats: s,
      pagination: { total, page, pages: Math.ceil(total / limit), limit },
    });
  } catch (err) { next(err); }
};

// ── GET /admin/transactions/:id ──────────────────────────────────────
exports.getTransaction = async (req, res, next) => {
  try {
    const tx = await Transaction.findById(req.params.id)
      .populate('user',    'name email')
      .populate('order',   '_id status totalAmount')
      .populate('invoice', 'invoiceNumber status');
    if (!tx) return next(new AppError('Transaction not found', 404));
    res.status(200).json({ success: true, data: tx });
  } catch (err) { next(err); }
};
```

- [ ] **Step 2: Verify**

```bash
node -e "require('./src/controllers/transaction.controller'); console.log('transaction controller ok')"
```

---

## Task 8: Hook Invoice + Transaction into payment.controller.js

**Files:**
- Modify: `backend/src/controllers/payment.controller.js`

- [ ] **Step 1: Add imports at the top of the file** (after existing requires)

Add these three lines immediately after the existing `const logger = require('../utils/logger');` line:

```js
const Invoice        = require('../models/invoice.model');
const Transaction    = require('../models/transaction.model');
const InvoiceService = require('../services/invoice.service');
```

- [ ] **Step 2: Hook into confirmPayment — after `await order.save()`**

Find this block in `confirmPayment`:
```js
      order.paymentDetails = {
        transactionId: paymentResult.transactionId,
        paymentDate: paymentResult.paymentDate,
        amount: order.finalAmount,
        paymentMethod,
      };
      await order.save();
```

Add immediately after `await order.save();`:
```js
      // Auto-generate invoice + log transaction for completed payment
      try {
        const invoice = await InvoiceService.generateInvoice(order._id, req.user.id);
        await Transaction.create({
          order:         order._id,
          invoice:       invoice._id,
          user:          req.user.id,
          type:          'payment',
          amount:        order.finalAmount,
          currency:      'USD',
          paymentMethod,
          transactionId: paymentResult.transactionId,
          status:        'completed',
        });
      } catch (invoiceErr) {
        // Non-fatal: payment already succeeded, invoice generation failure should not break it
        logger.warn('Invoice generation failed (non-fatal)', { error: invoiceErr.message, orderId: order._id });
      }
```

- [ ] **Step 3: Hook into processRefund — after `await order.save()`**

Find this in `processRefund`:
```js
    order.paymentStatus = 'refunded';
    order.status = 'cancelled';
    await order.save();
```

Add immediately after `await order.save();`:
```js
    // Mark invoice as refunded + log refund transaction
    try {
      await Invoice.findOneAndUpdate({ order: order._id }, { status: 'refunded' });
      await Transaction.create({
        order:         order._id,
        user:          order.user,
        type:          'refund',
        amount:        order.finalAmount,
        currency:      'USD',
        paymentMethod: order.paymentDetails?.paymentMethod,
        transactionId: refundResult.transactionId,
        status:        'completed',
      });
    } catch (txErr) {
      logger.warn('Refund transaction log failed (non-fatal)', { error: txErr.message, orderId: order._id });
    }
```

- [ ] **Step 4: Verify syntax**

```bash
node -e "require('./src/controllers/payment.controller'); console.log('payment controller ok')"
```

---

## Task 9: Hook Invoice into order.controller.js (admin manual complete)

**Files:**
- Modify: `backend/src/controllers/order.controller.js`

- [ ] **Step 1: Add imports** — after the existing `const logger = require('../utils/logger');` line:

```js
const Invoice        = require('../models/invoice.model');
const Transaction    = require('../models/transaction.model');
const InvoiceService = require('../services/invoice.service');
```

- [ ] **Step 2: Hook into updatePaymentStatus** — after `await order.save();` in `updatePaymentStatus`:

Find:
```js
    await order.save();
```

Add after it (inside the try block):
```js
    // Auto-generate invoice when admin manually marks payment as completed
    if (paymentStatus === 'completed') {
      try {
        const existing = await Invoice.findOne({ order: order._id });
        if (!existing) {
          const invoice = await InvoiceService.generateInvoice(order._id, req.user.id);
          await Transaction.create({
            order:         order._id,
            invoice:       invoice._id,
            user:          order.user._id || order.user,
            type:          'payment',
            amount:        order.totalAmount - (order.discount || 0),
            currency:      'USD',
            paymentMethod: order.paymentDetails?.paymentMethod || order.paymentMethod,
            transactionId: transactionId || order.paymentDetails?.transactionId,
            status:        'completed',
          });
        }
      } catch (invoiceErr) {
        logger.warn('Invoice generation on admin status update failed (non-fatal)', { error: invoiceErr.message });
      }
    }
```

- [ ] **Step 3: Verify**

```bash
node -e "require('./src/controllers/order.controller'); console.log('order controller ok')"
```

---

## Task 10: Register Routes

**Files:**
- Modify: `backend/src/routes/admin.routes.js`
- Modify: `backend/src/routes/payment.routes.js`

- [ ] **Step 1: Update admin.routes.js** — add imports and routes

Add at the top after the inventory require block:
```js
const {
  getInvoices,
  getInvoice,
  downloadInvoicePDF,
  generateInvoiceForOrder,
} = require('../controllers/invoice.controller');

const {
  getTransactions,
  getTransaction,
} = require('../controllers/transaction.controller');
```

Add at the bottom before `module.exports`:
```js
// Invoice routes — generate/:orderId MUST be before /:id to avoid route shadowing
router.get('/invoices',                           getInvoices);
router.post('/invoices/generate/:orderId',        generateInvoiceForOrder);
router.get('/invoices/:id',                       getInvoice);
router.get('/invoices/:id/pdf',                   downloadInvoicePDF);

// Transaction routes
router.get('/transactions',       getTransactions);
router.get('/transactions/:id',   getTransaction);
```

- [ ] **Step 2: Read payment.routes.js to find the refund route**

```bash
node -e "const r = require('./src/routes/payment.routes'); console.log('payment routes ok')"
```

Check the file to confirm the refund endpoint exists, then add `isAdmin` guard:
```js
// Find the refund route — it currently looks like:
// router.post('/:orderId/refund', isAuthenticated, processRefund);
// Change it to:
// router.post('/:orderId/refund', isAuthenticated, isAdmin, processRefund);
```

- [ ] **Step 3: Restart backend and verify routes are registered**

```bash
curl -s http://localhost:5000/api/admin/invoices \
  -H "Authorization: Bearer <token>" | python -c "import sys,json; d=json.load(sys.stdin); print('invoices route ok, success:', d.get('success'))"
```

---

## Task 11: Customer Invoice Route

**Files:**
- Modify: `backend/src/routes/order.routes.js` (or create a new route — check existing)

- [ ] **Step 1: Read the order routes file to find the right place**

Add to order routes (or a dedicated route file):
```js
const { getMyInvoice } = require('../controllers/invoice.controller');

// Customer can view their own invoices
router.get('/invoices/:id', isAuthenticated, getMyInvoice);
```

---

## Task 12: Frontend — API Service Files

**Files:**
- Create: `frontend/src/Services/api/invoiceApi.js`
- Create: `frontend/src/Services/api/transactionApi.js`

- [ ] **Step 1: Create invoiceApi.js**

```js
// frontend/src/Services/api/invoiceApi.js
import apiClient from "../core/api/apiClient";

const invoiceApi = {
  getInvoices:   (params = {}) =>
    apiClient.get('/admin/invoices', { params }).then(r => r.data),

  getInvoice:    (id) =>
    apiClient.get(`/admin/invoices/${id}`).then(r => r.data),

  generateInvoice: (orderId) =>
    apiClient.post(`/admin/invoices/generate/${orderId}`).then(r => r.data),

  // Returns a Blob for PDF download
  downloadPDF: async (id, invoiceNumber) => {
    const res = await apiClient.get(`/admin/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href  = url;
    link.download = `${invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export default invoiceApi;
```

- [ ] **Step 2: Create transactionApi.js**

```js
// frontend/src/Services/api/transactionApi.js
import apiClient from "../core/api/apiClient";

const transactionApi = {
  getTransactions: (params = {}) =>
    apiClient.get('/admin/transactions', { params }).then(r => r.data),

  getTransaction: (id) =>
    apiClient.get(`/admin/transactions/${id}`).then(r => r.data),
};

export default transactionApi;
```

---

## Task 13: AdminInvoices Page

**Files:**
- Create: `frontend/src/Pages/Admin/Invoices/AdminInvoices.jsx`
- Create: `frontend/src/Pages/Admin/Invoices/AdminInvoices.css`

- [ ] **Step 1: Create AdminInvoices.jsx**

```jsx
// frontend/src/Pages/Admin/Invoices/AdminInvoices.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFileText, FiDollarSign, FiRotateCcw,
  FiDownload, FiEye, FiX, FiRefreshCw, FiSearch,
} from "react-icons/fi";
import invoiceApi from "../../../Services/api/invoiceApi";
import { useToast } from "../../../context/ToastContext";
import "./AdminInvoices.css";

const STATUS_OPTS = [
  { value: "",         label: "All Statuses" },
  { value: "issued",   label: "Issued" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_BADGE = {
  issued:   { cls: "inv-status--issued",   label: "Issued" },
  refunded: { cls: "inv-status--refunded", label: "Refunded" },
};

const EMPTY_DRAWER = { open: false, invoice: null };

export default function AdminInvoices() {
  const { addToast } = useToast();

  const [invoices, setInvoices] = useState([]);
  const [stats,    setStats]    = useState({ totalIssued: 0, totalRevenue: 0, totalRefunded: 0 });
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState("");
  const [drawer,   setDrawer]   = useState(EMPTY_DRAWER);
  const [pdfLoading, setPdfLoading] = useState(null); // invoice id being downloaded

  // ── Fetch ────────────────────────────────────────────────────────
  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await invoiceApi.getInvoices({
        search: search || undefined,
        status: status || undefined,
        limit: 100,
      });
      setInvoices(res.data  || []);
      if (res.stats) setStats(res.stats);
    } catch {
      addToast("Failed to load invoices", "error");
    } finally {
      setLoading(false);
    }
  }, [search, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handlePDF = async (inv) => {
    setPdfLoading(inv._id);
    try {
      await invoiceApi.downloadPDF(inv._id, inv.invoiceNumber);
    } catch {
      addToast("PDF download failed", "error");
    } finally {
      setPdfLoading(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Invoices</h1>
          <p className="admin-page-subtitle">All generated invoices from completed payments.</p>
        </div>
        <button className="inv-refresh-btn" onClick={fetchInvoices}>
          <FiRefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="invc-stats-strip">
        {[
          { icon: <FiFileText />,  label: "Total Invoices",  value: stats.totalIssued || 0,                             cls: "invc-stat--default" },
          { icon: <FiDollarSign />, label: "Total Revenue",  value: `$${(stats.totalRevenue || 0).toFixed(2)}`,         cls: "invc-stat--success" },
          { icon: <FiRotateCcw />, label: "Total Refunded",  value: `$${(stats.totalRefunded || 0).toFixed(2)}`,        cls: "invc-stat--danger"  },
        ].map((s, i) => (
          <motion.div key={s.label} className={`invc-stat ${s.cls}`}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
          >
            <div className="invc-stat-icon">{s.icon}</div>
            <div>
              <p className="invc-stat-value">{s.value}</p>
              <p className="invc-stat-label">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-card invc-toolbar">
        <div className="invc-search-wrap">
          <FiSearch className="invc-search-icon" size={15} />
          <input
            className="invc-search"
            type="text"
            placeholder="Search by invoice number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="inv-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card">
        {loading ? (
          <div className="inv-loading">Loading invoices…</div>
        ) : invoices.length === 0 ? (
          <div className="inv-empty">No invoices found.</div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {invoices.map((inv, i) => {
                    const badge = STATUS_BADGE[inv.status] || STATUS_BADGE.issued;
                    return (
                      <motion.tr key={inv._id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      >
                        <td><code className="invc-number">{inv.invoiceNumber}</code></td>
                        <td>
                          <div className="invc-customer">
                            <span className="invc-customer-name">{inv.user?.name || "—"}</span>
                            <span className="invc-customer-email">{inv.user?.email || ""}</span>
                          </div>
                        </td>
                        <td>{new Date(inv.paidAt).toLocaleDateString()}</td>
                        <td><strong>${(inv.total || 0).toFixed(2)}</strong></td>
                        <td>
                          <span className={`invc-status-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <div className="invc-actions">
                            <button
                              className="inv-action-btn inv-action-btn--history"
                              onClick={() => setDrawer({ open: true, invoice: inv })}
                            >
                              <FiEye size={12} /> View
                            </button>
                            <button
                              className="inv-action-btn inv-action-btn--restock"
                              onClick={() => handlePDF(inv)}
                              disabled={pdfLoading === inv._id}
                            >
                              <FiDownload size={12} />
                              {pdfLoading === inv._id ? "…" : "PDF"}
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {drawer.open && drawer.invoice && (
          <>
            <motion.div className="inv-drawer-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDrawer(EMPTY_DRAWER)}
            />
            <motion.aside className="inv-drawer invc-drawer"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              <div className="inv-drawer-header">
                <div>
                  <h3>Invoice Detail</h3>
                  <p>{drawer.invoice.invoiceNumber}</p>
                </div>
                <button className="inv-drawer-close" onClick={() => setDrawer(EMPTY_DRAWER)}>
                  <FiX size={18} />
                </button>
              </div>

              <div className="inv-drawer-body invc-drawer-body">
                {/* Customer */}
                <div className="invc-detail-section">
                  <h4>Customer</h4>
                  <p>{drawer.invoice.user?.name}</p>
                  <p className="invc-muted">{drawer.invoice.user?.email}</p>
                </div>

                {/* Shipping */}
                {drawer.invoice.shippingAddress && (
                  <div className="invc-detail-section">
                    <h4>Ship To</h4>
                    <p>{drawer.invoice.shippingAddress.street}</p>
                    <p>{drawer.invoice.shippingAddress.city}, {drawer.invoice.shippingAddress.state} {drawer.invoice.shippingAddress.zipCode}</p>
                    <p>{drawer.invoice.shippingAddress.country}</p>
                  </div>
                )}

                {/* Line Items */}
                <div className="invc-detail-section">
                  <h4>Line Items</h4>
                  <table className="invc-line-table">
                    <thead>
                      <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
                    </thead>
                    <tbody>
                      {(drawer.invoice.lineItems || []).map((li, idx) => (
                        <tr key={idx}>
                          <td>{li.name}</td>
                          <td>{li.quantity}</td>
                          <td>${li.unitPrice?.toFixed(2)}</td>
                          <td>${li.total?.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="invc-totals">
                  <div className="invc-total-row">
                    <span>Subtotal</span>
                    <span>${(drawer.invoice.subtotal || 0).toFixed(2)}</span>
                  </div>
                  {drawer.invoice.discount > 0 && (
                    <div className="invc-total-row invc-total-row--discount">
                      <span>Discount</span>
                      <span>-${drawer.invoice.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="invc-total-row invc-total-row--grand">
                    <span>Total</span>
                    <span>${(drawer.invoice.total || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment */}
                <div className="invc-detail-section">
                  <h4>Payment</h4>
                  <p>Method: <strong>{drawer.invoice.paymentMethod || "N/A"}</strong></p>
                  <p className="invc-muted">TxID: {drawer.invoice.transactionId || "N/A"}</p>
                </div>

                <button
                  className="invc-pdf-btn"
                  onClick={() => handlePDF(drawer.invoice)}
                  disabled={pdfLoading === drawer.invoice._id}
                >
                  <FiDownload size={14} />
                  {pdfLoading === drawer.invoice._id ? "Generating…" : "Download PDF"}
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create AdminInvoices.css**

```css
/* frontend/src/Pages/Admin/Invoices/AdminInvoices.css */

/* Stats strip */
.invc-stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.invc-stat {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  border-left: 4px solid transparent;
}
.invc-stat--default { border-left-color: #6366f1; }
.invc-stat--success { border-left-color: #10b981; }
.invc-stat--danger  { border-left-color: #ef4444; }
.invc-stat-icon { font-size: 22px; opacity: .75; }
.invc-stat--default .invc-stat-icon { color: #6366f1; }
.invc-stat--success .invc-stat-icon { color: #10b981; }
.invc-stat--danger  .invc-stat-icon { color: #ef4444; }
.invc-stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; line-height: 1.1; }
.invc-stat-label { font-size: 12px; color: #888; margin-top: 2px; }

/* Toolbar */
.invc-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.invc-search-wrap {
  position: relative;
  flex: 1;
  min-width: 200px;
}
.invc-search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #aaa;
  pointer-events: none;
}
.invc-search {
  width: 100%;
  padding: 9px 12px 9px 36px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color .2s;
}
.invc-search:focus { border-color: #6366f1; }

/* Table — reuses inv-table styles from AdminInventory */
.invc-number {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
  background: #f1f5f9;
  padding: 2px 8px;
  border-radius: 4px;
}
.invc-customer { display: flex; flex-direction: column; gap: 2px; }
.invc-customer-name  { font-weight: 600; font-size: 14px; color: #1a1a2e; }
.invc-customer-email { font-size: 12px; color: #888; }

.invc-status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.inv-status--issued   { background: #dcfce7; color: #166534; }
.inv-status--refunded { background: #fee2e2; color: #991b1b; }

.invc-actions { display: flex; gap: 6px; }

/* Drawer extras */
.invc-drawer { width: 460px; }
.invc-drawer-body { display: flex; flex-direction: column; gap: 20px; padding: 20px; overflow-y: auto; }
.invc-detail-section h4 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: #888; margin-bottom: 8px; }
.invc-detail-section p  { font-size: 14px; color: #333; line-height: 1.5; }
.invc-muted { color: #888 !important; font-size: 12px !important; }

.invc-line-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.invc-line-table th { background: #f8fafc; padding: 7px 10px; text-align: left; font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; }
.invc-line-table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; color: #333; }
.invc-line-table td:not(:first-child) { text-align: right; }
.invc-line-table th:not(:first-child) { text-align: right; }

.invc-totals { background: #f8fafc; border-radius: 8px; padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.invc-total-row { display: flex; justify-content: space-between; font-size: 14px; color: #444; }
.invc-total-row--discount { color: #ef4444; }
.invc-total-row--grand { font-size: 16px; font-weight: 700; color: #1a1a2e; padding-top: 8px; border-top: 2px solid #e2e8f0; }

.invc-pdf-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px;
  background: #1a1a2e;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background .2s;
  margin-top: 4px;
}
.invc-pdf-btn:hover    { background: #2d2d4e; }
.invc-pdf-btn:disabled { opacity: .6; cursor: not-allowed; }

@media (max-width: 768px) {
  .invc-stats-strip { grid-template-columns: 1fr 1fr; }
  .invc-drawer { width: 100vw; }
}
@media (max-width: 480px) {
  .invc-stats-strip { grid-template-columns: 1fr; }
}
```

---

## Task 14: AdminTransactions Page

**Files:**
- Create: `frontend/src/Pages/Admin/Transactions/AdminTransactions.jsx`
- Create: `frontend/src/Pages/Admin/Transactions/AdminTransactions.css`

- [ ] **Step 1: Create AdminTransactions.jsx**

```jsx
// frontend/src/Pages/Admin/Transactions/AdminTransactions.jsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiTrendingUp, FiTrendingDown, FiActivity, FiRefreshCw,
} from "react-icons/fi";
import transactionApi from "../../../Services/api/transactionApi";
import { useToast } from "../../../context/ToastContext";
import "./AdminTransactions.css";

const TYPE_OPTS = [
  { value: "",        label: "All Types" },
  { value: "payment", label: "Payments" },
  { value: "refund",  label: "Refunds" },
];

const METHOD_OPTS = [
  { value: "",             label: "All Methods" },
  { value: "stripe",       label: "Stripe" },
  { value: "paypal",       label: "PayPal" },
  { value: "credit_card",  label: "Credit Card" },
];

const TYPE_BADGE = {
  payment: { cls: "txn-badge--payment", label: "Payment" },
  refund:  { cls: "txn-badge--refund",  label: "Refund"  },
};

export default function AdminTransactions() {
  const { addToast } = useToast();

  const [transactions, setTransactions] = useState([]);
  const [stats,  setStats]  = useState({ totalRevenue: 0, totalRefunds: 0, netRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [type,    setType]    = useState("");
  const [method,  setMethod]  = useState("");

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await transactionApi.getTransactions({
        type:          type   || undefined,
        paymentMethod: method || undefined,
        limit: 100,
      });
      setTransactions(res.data  || []);
      if (res.stats) setStats(res.stats);
    } catch {
      addToast("Failed to load transactions", "error");
    } finally {
      setLoading(false);
    }
  }, [type, method]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  return (
    <motion.div
      className="admin-page"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Transactions</h1>
          <p className="admin-page-subtitle">Financial ledger of all payments and refunds.</p>
        </div>
        <button className="inv-refresh-btn" onClick={fetchTransactions}>
          <FiRefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="txn-stats-strip">
        {[
          { icon: <FiTrendingUp />,  label: "Total Revenue",  value: `$${(stats.totalRevenue || 0).toFixed(2)}`,  cls: "txn-stat--success" },
          { icon: <FiTrendingDown />, label: "Total Refunds", value: `$${(stats.totalRefunds || 0).toFixed(2)}`,  cls: "txn-stat--danger"  },
          { icon: <FiActivity />,    label: "Net Revenue",    value: `$${(stats.netRevenue   || 0).toFixed(2)}`,  cls: "txn-stat--default" },
        ].map((s, i) => (
          <motion.div key={s.label} className={`txn-stat ${s.cls}`}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
          >
            <div className="txn-stat-icon">{s.icon}</div>
            <div>
              <p className="txn-stat-value">{s.value}</p>
              <p className="txn-stat-label">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="admin-card invc-toolbar">
        <select className="inv-select" value={type} onChange={e => setType(e.target.value)}>
          {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="inv-select" value={method} onChange={e => setMethod(e.target.value)}>
          {METHOD_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card">
        {loading ? (
          <div className="inv-loading">Loading transactions…</div>
        ) : transactions.length === 0 ? (
          <div className="inv-empty">No transactions found.</div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Invoice</th>
                  <th>Transaction ID</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {transactions.map((tx, i) => {
                    const badge = TYPE_BADGE[tx.type] || TYPE_BADGE.payment;
                    return (
                      <motion.tr key={tx._id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      >
                        <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div className="invc-customer">
                            <span className="invc-customer-name">{tx.user?.name || "—"}</span>
                            <span className="invc-customer-email">{tx.user?.email || ""}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`txn-badge ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td>
                          <span className={tx.type === "refund" ? "txn-amount--refund" : "txn-amount--payment"}>
                            {tx.type === "refund" ? "-" : "+"}${(tx.amount || 0).toFixed(2)}
                          </span>
                        </td>
                        <td>{tx.paymentMethod?.replace("_", " ") || "—"}</td>
                        <td>
                          {tx.invoice
                            ? <code className="invc-number">{tx.invoice.invoiceNumber}</code>
                            : <span className="txn-na">—</span>}
                        </td>
                        <td>
                          <span className="txn-txid">{tx.transactionId || "—"}</span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create AdminTransactions.css**

```css
/* frontend/src/Pages/Admin/Transactions/AdminTransactions.css */

.txn-stats-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.txn-stat {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  border-left: 4px solid transparent;
}
.txn-stat--success { border-left-color: #10b981; }
.txn-stat--danger  { border-left-color: #ef4444; }
.txn-stat--default { border-left-color: #6366f1; }
.txn-stat-icon { font-size: 22px; opacity: .75; }
.txn-stat--success .txn-stat-icon { color: #10b981; }
.txn-stat--danger  .txn-stat-icon { color: #ef4444; }
.txn-stat--default .txn-stat-icon { color: #6366f1; }
.txn-stat-value { font-size: 22px; font-weight: 700; color: #1a1a2e; line-height: 1.1; }
.txn-stat-label { font-size: 12px; color: #888; margin-top: 2px; }

.txn-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.txn-badge--payment { background: #dcfce7; color: #166534; }
.txn-badge--refund  { background: #fee2e2; color: #991b1b; }

.txn-amount--payment { font-weight: 700; color: #059669; }
.txn-amount--refund  { font-weight: 700; color: #dc2626; }

.txn-txid {
  font-family: 'Courier New', monospace;
  font-size: 11px;
  color: #888;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}
.txn-na { color: #ccc; }

@media (max-width: 768px) {
  .txn-stats-strip { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .txn-stats-strip { grid-template-columns: 1fr; }
}
```

---

## Task 15: Wire into AdminLayout + main.jsx

**Files:**
- Modify: `frontend/src/Components/Admin/AdminLayout.jsx`
- Modify: `frontend/src/main.jsx`

- [ ] **Step 1: Add sidebar items to AdminLayout.jsx**

Find the existing `FiBox` import line in `AdminLayout.jsx` and add to it:
```js
import { ..., FiFileText, FiCreditCard } from "react-icons/fi";
```

Find the `menuItems` array and add after the Inventory entry:
```js
{ path: "/admin/invoices",     label: "Invoices",      icon: <FiFileText size={18} /> },
{ path: "/admin/transactions", label: "Transactions",  icon: <FiCreditCard size={18} /> },
```

- [ ] **Step 2: Add routes to main.jsx**

Add imports:
```js
import AdminInvoices     from "./Pages/Admin/Invoices/AdminInvoices.jsx";
import AdminTransactions from "./Pages/Admin/Transactions/AdminTransactions.jsx";
```

Add routes inside the admin children array after `inventory`:
```js
{ path: "invoices",     element: <AdminInvoices /> },
{ path: "transactions", element: <AdminTransactions /> },
```

---

## Task 16: Frontend Build Verification

- [ ] **Step 1: Run build**

```bash
cd "C:\Users\Raj\OneDrive\Documents\Pet Project\frontend"
npm run build
```

Expected: `✓ N modules transformed`, `built in Xs`, **zero errors**.

---

## Task 17: End-to-End API Test

- [ ] **Step 1: Login and get token**

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nsseetohul@gmail.com","password":"Uzumaki007*"}' \
  | python -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])")
```

- [ ] **Step 2: GET /admin/invoices**

```bash
curl -s "http://localhost:5000/api/admin/invoices" \
  -H "Authorization: Bearer $TOKEN" | python -c "
import sys,json; d=json.load(sys.stdin)
print('success:', d.get('success'))
print('stats:', d.get('stats'))
print('count:', len(d.get('data',[])))
"
```
Expected: `success: True`, stats object present.

- [ ] **Step 3: POST /admin/invoices/generate/:orderId (on a completed order)**

```bash
# First get an order ID with completed payment
ORDER_ID=$(curl -s "http://localhost:5000/api/orders" \
  -H "Authorization: Bearer $TOKEN" | python -c "
import sys,json; d=json.load(sys.stdin)
orders=[o for o in d.get('data',[]) if o.get('paymentStatus')=='completed']
print(orders[0]['_id'] if orders else 'NO_COMPLETED_ORDERS')
")
echo "Order: $ORDER_ID"

curl -s -X POST "http://localhost:5000/api/admin/invoices/generate/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN" | python -c "
import sys,json; d=json.load(sys.stdin)
print('success:', d.get('success'))
inv=d.get('data',{})
print('invoiceNumber:', inv.get('invoiceNumber'))
print('total:', inv.get('total'))
"
```
Expected: `invoiceNumber: INV-2026-000X`, `total: <amount>`.

- [ ] **Step 4: GET /admin/transactions**

```bash
curl -s "http://localhost:5000/api/admin/transactions" \
  -H "Authorization: Bearer $TOKEN" | python -c "
import sys,json; d=json.load(sys.stdin)
print('success:', d.get('success'))
print('stats:', d.get('stats'))
"
```
Expected: `success: True`, stats with netRevenue.

- [ ] **Step 5: PDF endpoint — verify it returns a PDF stream**

```bash
# Get an invoice ID
INV_ID=$(curl -s "http://localhost:5000/api/admin/invoices" \
  -H "Authorization: Bearer $TOKEN" | python -c "
import sys,json; d=json.load(sys.stdin)
invs=d.get('data',[])
print(invs[0]['_id'] if invs else 'NO_INVOICES')
")

curl -s -I "http://localhost:5000/api/admin/invoices/$INV_ID/pdf" \
  -H "Authorization: Bearer $TOKEN" | grep -i "content-type"
```
Expected: `content-type: application/pdf`

---

## Task 18: Update CHANGELOG.md

- [ ] **Step 1: Mark Subsystem B as complete**

In `docs/CHANGELOG.md`, update the Subsystem B section:

```markdown
## Subsystem B — Invoicing & Transactions
**Started:** 2026-06-03 | **Completed:** 2026-06-03 ✅

### Backend
- ✅ `Counter` model — auto-increment invoice numbers
- ✅ `Invoice` model — snapshotted line items, issued/refunded status
- ✅ `Transaction` model — financial ledger
- ✅ `InvoiceService` — generateInvoice() + generatePDF() (pdfkit)
- ✅ `invoice.controller.js` — 5 endpoints
- ✅ `transaction.controller.js` — 2 endpoints
- ✅ Hook payment.controller → auto-generate invoice on confirm
- ✅ Hook payment.controller → log refund transaction
- ✅ Hook order.controller → generate invoice on admin manual complete
- ✅ Added isAdmin guard to processRefund endpoint
- ✅ Routes added to admin.routes.js (7 routes)

### Frontend
- ✅ `invoiceApi.js` + `transactionApi.js`
- ✅ `AdminInvoices.jsx` + CSS — stats, table, detail drawer, PDF download
- ✅ `AdminTransactions.jsx` + CSS — ledger with type badges, revenue stats
- ✅ Routes + sidebar wired
- ✅ Frontend build verified
```
