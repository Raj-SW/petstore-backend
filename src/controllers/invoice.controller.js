const Invoice        = require('../models/invoice.model');
const Transaction    = require('../models/transaction.model');
const Order          = require('../models/order.model');
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

    const ownerId = (invoice.user?._id || invoice.user)?.toString();
    if (!ownerId || ownerId !== req.user.id) {
      return next(new AppError('Not authorised to view this invoice', 403));
    }
    res.status(200).json({ success: true, data: invoice });
  } catch (err) { next(err); }
};
