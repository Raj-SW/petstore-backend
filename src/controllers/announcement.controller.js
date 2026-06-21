const SaleAnnouncement = require('../models/saleAnnouncement.model');
const Product = require('../models/product.model');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { makeUnsubscribeToken, verifyUnsubscribeToken } = require('../utils/unsubscribeToken');
const logger = require('../utils/logger');

const { apiUrl, productUrl, shopUrl } = require('../config/urls');

const MAX_RECIPIENTS = parseInt(process.env.ANNOUNCEMENT_MAX_RECIPIENTS || '500', 10);

const formatMUR = (amount) => `Rs ${Number(amount || 0).toLocaleString('en-US')}`;

// Build per-email product rows (Handlebars can't compute, so precompute here).
function buildProductRows(products) {
  return products.map((p) => {
    const onSale = p.isOnSaleNow;
    return {
      name: p.name,
      image: p.images && p.images[0] ? p.images[0].url : '',
      link: productUrl(p._id),
      priceLabel: formatMUR(p.price),
      salePriceLabel: onSale ? formatMUR(p.salePrice) : null,
      discountLabel: onSale ? `${p.discountPercentLabel}% OFF` : null,
    };
  });
}

// POST /api/announcements — admin
exports.createAnnouncement = async (req, res, next) => {
  try {
    const {
      subject, message = '', productIds, source = 'composer',
    } = req.body;

    const products = await Product.find({ _id: { $in: productIds } });
    if (!products.length) {
      return next(new AppError('No valid products found for this announcement', 400));
    }

    const recipients = await User.find({
      role: 'customer',
      'emailPreferences.sales': { $ne: false },
    }).select('name email');

    const audienceCount = recipients.length;
    const capped = recipients.slice(0, MAX_RECIPIENTS);
    const rows = buildProductRows(products);

    let sentCount = 0;
    let failedCount = 0;

    // Sequential send — Resend SMTP is one-recipient-per-call. Per-recipient
    // failures are non-fatal so one bad address never aborts the batch.
    for (const user of capped) {
      try {
        const unsubscribeUrl = `${apiUrl('announcements/unsubscribe')}?token=${makeUnsubscribeToken(user._id)}`;
        // eslint-disable-next-line no-await-in-loop
        await sendEmail({
          to: user.email,
          subject,
          template: 'sale-announcement',
          data: {
            name: user.name,
            subject,
            message,
            products: rows,
            shopUrl: shopUrl(),
            unsubscribeUrl,
          },
        });
        sentCount += 1;
      } catch (err) {
        failedCount += 1;
        logger.warn('Announcement email failed (non-fatal)', { userId: user._id, error: err.message });
      }
    }

    const announcement = await SaleAnnouncement.create({
      subject,
      message,
      products: products.map((p) => p._id),
      audienceCount,
      sentCount,
      failedCount,
      source,
      createdBy: req.user._id,
      sentAt: new Date(),
    });

    const note = audienceCount > MAX_RECIPIENTS
      ? `Sent to the first ${MAX_RECIPIENTS} of ${audienceCount} subscribers (cap).`
      : `Sent to ${sentCount} of ${audienceCount} subscribers.`;

    logger.info(`Sale announcement sent by admin ${req.user._id}`, { announcementId: announcement._id, sentCount, failedCount });
    return res.status(201).json({ success: true, message: note, data: announcement });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements — admin history
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await SaleAnnouncement.find()
      .sort('-createdAt')
      .populate('products', 'name');
    return res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements/unsubscribe?token= — public, no auth
exports.unsubscribe = async (req, res) => {
  const page = (status, heading, sub = '') =>
    res.status(status).send(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
      + '<body style="font-family:Arial,sans-serif;text-align:center;padding:60px 20px;color:#333">'
      + `<h2>${heading}</h2>${sub ? `<p>${sub}</p>` : ''}</body></html>`
    );
  try {
    const { token } = req.query;
    if (!token) return page(400, 'Invalid unsubscribe link.');
    const userId = verifyUnsubscribeToken(token);
    if (!userId) return page(400, 'This unsubscribe link is invalid or has expired.');
    await User.findByIdAndUpdate(userId, { 'emailPreferences.sales': false });
    return page(200, 'You have been unsubscribed from sale emails.', 'You can re-enable them anytime in your VitalPaws profile.');
  } catch {
    return page(400, 'Something went wrong. Please try again later.');
  }
};
