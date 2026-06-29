const Announcement = require('../models/announcement.model');
const { bucketForType } = require('../models/announcement.model');
const Product = require('../models/product.model');
const PetCareTip = require('../models/petCareTip.model');
const GalleryPost = require('../models/galleryPost.model');
const User = require('../models/user.model');
const { AppError } = require('../middlewares/errorHandler');
const { sendEmail } = require('../utils/email');
const { makeUnsubscribeToken, verifyUnsubscribeToken, BUCKET_FIELD } = require('../utils/unsubscribeToken');
const logger = require('../utils/logger');

const { apiUrl, productUrl, shopUrl, frontendUrl } = require('../config/urls');
const { formatMUR } = require('../utils/currency');

const MAX_RECIPIENTS = Number.parseInt(process.env.ANNOUNCEMENT_MAX_RECIPIENTS || '500', 10);

const PRODUCT_TYPES = new Set(['sale', 'new_product', 'price_drop', 'restock']);

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

function formatEventWhen(event) {
  if (!event?.startsAt) return '';
  const opts = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const start = new Date(event.startsAt).toLocaleString('en-GB', opts);
  if (event.endsAt) return `${start} – ${new Date(event.endsAt).toLocaleString('en-GB', opts)}`;
  return start;
}

// Resolve the announcement target and assemble the per-type template data.
async function resolveTarget(body) {
  const { type } = body;

  if (PRODUCT_TYPES.has(type)) {
    const products = await Product.find({ _id: { $in: body.productIds } });
    if (!products.length) throw new AppError('No valid products found for this announcement', 400);
    return {
      productRefs: products.map((p) => p._id),
      data: { isProductType: true, products: buildProductRows(products), shopUrl: shopUrl() },
    };
  }

  if (type === 'new_tip' || type === 'new_post') {
    const { kind, id } = body.contentRef;
    const Model = kind === 'tip' ? PetCareTip : GalleryPost;
    const doc = await Model.findById(id);
    if (!doc) throw new AppError('The referenced tip or post no longer exists', 400);
    const readUrl = kind === 'tip' ? frontendUrl(`pet-care-tips/${doc.slug}`) : frontendUrl(`gallery/${doc.slug}`);
    return {
      contentRef: { kind, id: doc._id },
      data: {
        isContent: true,
        content: {
          title: doc.title,
          coverImage: doc.coverImage?.url || doc.coverImage || '',
          excerpt: doc.excerpt || '',
          readUrl,
        },
      },
    };
  }

  if (type === 'event') {
    return {
      event: body.event,
      data: { isEvent: true, event: { ...body.event, whenLabel: formatEventWhen(body.event) }, cta: body.cta || null },
    };
  }

  // general
  return { cta: body.cta || null, data: { isGeneral: true, cta: body.cta || null } };
}

// POST /api/announcements — admin
exports.createAnnouncement = async (req, res, next) => {
  try {
    const { subject, message = '', source = 'composer', type } = req.body;
    const bucket = bucketForType(type);
    const prefField = BUCKET_FIELD[bucket]; // 'sales' | 'news'

    const resolved = await resolveTarget(req.body);

    const recipients = await User.find({
      role: 'customer',
      [`emailPreferences.${prefField}`]: { $ne: false },
    }).select('name email');

    const audienceCount = recipients.length;
    const capped = recipients.slice(0, MAX_RECIPIENTS);

    let sentCount = 0;
    let failedCount = 0;

    // Sequential send — Resend SMTP is one-recipient-per-call. Per-recipient
    // failures are non-fatal so one bad address never aborts the batch.
    for (const user of capped) {
      try {
        const unsubscribeUrl = `${apiUrl('announcements/unsubscribe')}?token=${makeUnsubscribeToken(user._id, bucket)}`;
        // eslint-disable-next-line no-await-in-loop
        await sendEmail({
          to: user.email,
          subject,
          template: 'announcement',
          data: {
            name: user.name,
            subject,
            message,
            unsubscribeUrl,
            ...resolved.data,
          },
        });
        sentCount += 1;
      } catch (err) {
        failedCount += 1;
        logger.warn('Announcement email failed (non-fatal)', { userId: user._id, error: err.message });
      }
    }

    const announcement = await Announcement.create({
      type,
      subject,
      message,
      products: resolved.productRefs || [],
      contentRef: resolved.contentRef,
      event: resolved.event,
      cta: resolved.cta,
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

    logger.info(`Announcement (${type}) sent by admin ${req.user._id}`, { announcementId: announcement._id, sentCount, failedCount });
    return res.status(201).json({ success: true, message: note, data: announcement });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements — admin history (new collection)
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find()
      .sort('-createdAt')
      .populate('products', 'name');
    return res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (error) {
    return next(error);
  }
};

// GET /api/announcements/unsubscribe?token= — public, no auth. Flips the
// announcement bucket encoded in the token (promotions → sales, news → news).
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
    const result = verifyUnsubscribeToken(token);
    if (!result) return page(400, 'This unsubscribe link is invalid or has expired.');
    await User.findByIdAndUpdate(result.userId, { [`emailPreferences.${result.field}`]: false });
    const label = result.bucket === 'news' ? 'news & updates' : 'sale & promotional';
    return page(200, `You have been unsubscribed from ${label} emails.`, 'You can re-enable them anytime in your VitalPaws profile.');
  } catch {
    return page(400, 'Something went wrong. Please try again later.');
  }
};
