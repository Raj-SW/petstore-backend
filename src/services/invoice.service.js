// backend/src/services/invoice.service.js
const PDFDocument = require('pdfkit');
const Counter     = require('../models/counter.model');
const Invoice     = require('../models/invoice.model');
const Order       = require('../models/order.model');
const User        = require('../models/user.model');
const { formatMUR } = require('../utils/currency');

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
    const originalUnitPrice = item.originalPrice ?? null;
    // Per-line savings (was/now) when an original price was snapshotted above the paid price.
    const lineDiscount = originalUnitPrice && originalUnitPrice > item.price
      ? (originalUnitPrice - item.price) * item.quantity
      : 0;
    return {
      name:              productName,
      variantLabel:      item.variantLabel || null,
      quantity:          item.quantity,
      unitPrice:         item.price,
      originalUnitPrice,
      lineDiscount,
      total:             item.price * item.quantity,
    };
  });

  const subtotal = order.totalAmount;
  const discount = order.discount || 0;
  const shippingFee = order.shippingFee || 0;
  const tax = order.tax || 0;
  const taxInclusive = order.taxInclusive !== false;
  // Prefer the order's snapshotted grandTotal; fall back for legacy orders.
  const grandTotal = typeof order.grandTotal === 'number' && order.grandTotal > 0
    ? order.grandTotal
    : (subtotal - discount) + shippingFee + (taxInclusive ? 0 : tax);
  const total = grandTotal;

  // Snapshot customer details so the invoice stays stable after profile edits.
  const customerUser = await User.findById(userId).select('name email phoneNumber');

  const invoice = await Invoice.create({
    invoiceNumber,
    order:    order._id,
    user:     userId,
    currency: 'MUR',
    lineItems,
    subtotal,
    discount,
    discountCode:  order.discountCode || null,
    shippingFee,
    tax,
    taxInclusive,
    grandTotal,
    total,
    shippingAddress: order.shippingAddress,
    billingAddress:  order.shippingAddress, // billing defaults to shipping
    customer: customerUser ? {
      name:  customerUser.name,
      email: customerUser.email,
      phone: customerUser.phoneNumber,
    } : undefined,
    paymentMethod:   order.paymentDetails?.paymentMethod || order.paymentMethod,
    transactionId:   order.paymentDetails?.transactionId,
    orderDate:       order.createdAt,
    source:          order.source || 'manual',
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
    const cust = invoice.customer || {};
    doc.fontSize(9).fillColor(BRAND).text('BILL TO', 50, 115);
    doc.fillColor('#333')
      .text(cust.name || user.name || 'Customer', 50, 130)
      .text(cust.email || user.email || '', 50, 143);

    const addr = invoice.billingAddress || invoice.shippingAddress || {};
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
      const rowH = (item.originalUnitPrice && item.originalUnitPrice > item.unitPrice) ? 30 : 22;
      if (i % 2 === 1) doc.rect(50, y - 4, 495, rowH).fill(LIGHT);
      const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
      doc.fontSize(9).fillColor('#333')
        .text(label,                       60,  y, { width: 230 })
        .text(String(item.quantity),          300,  y, { width: 60,  align: 'right' })
        .text(formatMUR(item.unitPrice), 370, y, { width: 85,  align: 'right' })
        .text(formatMUR(item.total),    460,  y, { width: 75,  align: 'right' });
      if (item.originalUnitPrice && item.originalUnitPrice > item.unitPrice) {
        doc.fontSize(7).fillColor(RED)
          .text(`was ${formatMUR(item.originalUnitPrice)} · you saved ${formatMUR(item.lineDiscount)}`, 60, y + 11, { width: 230 });
      }
      y += rowH;
    });

    // ── Totals ────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
    y += 12;

    const totalRow = (label, value, color = '#555') => {
      doc.fontSize(9).fillColor(color)
        .text(label, 350, y, { width: 100 })
        .text(value, 460, y, { width: 75, align: 'right' });
      y += 18;
    };

    totalRow('Subtotal:', formatMUR(invoice.subtotal));
    if (invoice.discount > 0) {
      totalRow(invoice.discountCode ? `Discount (${invoice.discountCode}):` : 'Discount:', `-${formatMUR(invoice.discount)}`, RED);
    }
    totalRow('Shipping:', invoice.shippingFee > 0 ? formatMUR(invoice.shippingFee) : 'FREE');
    if (invoice.tax > 0) {
      totalRow(invoice.taxInclusive ? 'VAT (incl.):' : 'VAT:', formatMUR(invoice.tax));
    }
    doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
    y += 10;

    doc.fontSize(13).fillColor(BRAND)
      .text('TOTAL:',              350, y, { width: 100 })
      .text(formatMUR(invoice.grandTotal || invoice.total), 460, y, { width: 75, align: 'right' });

    if (invoice.source === 'subscription') {
      y += 22;
      doc.fontSize(8).fillColor(MUTED).text('Recurring subscription order', 350, y, { width: 185, align: 'right' });
    }

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
