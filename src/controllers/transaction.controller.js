const Transaction  = require('../models/transaction.model');
const { AppError } = require('../middlewares/errorHandler');
const { toSafeString } = require('../utils/sanitize');

// ── GET /admin/transactions ──────────────────────────────────────────
exports.getTransactions = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const filter = {};
    const type          = toSafeString(req.query.type);
    const paymentMethod = toSafeString(req.query.paymentMethod);
    const status        = toSafeString(req.query.status);
    if (type)          filter.type          = type;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (status)        filter.status        = status;
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

    const [stats] = await Transaction.aggregate([
      { $match: { status: 'completed' } },
      { $group: {
        _id: null,
        totalRevenue:  { $sum: { $cond: [{ $eq: ['$type', 'payment'] }, '$amount', 0] } },
        totalRefunds:  { $sum: { $cond: [{ $eq: ['$type', 'refund']  }, '$amount', 0] } },
        totalCount:    { $sum: 1 },
      }},
    ]);

    const s      = stats || { totalRevenue: 0, totalRefunds: 0, totalCount: 0 };
    s.netRevenue = s.totalRevenue - s.totalRefunds;

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
