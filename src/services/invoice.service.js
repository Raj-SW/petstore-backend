// backend/src/services/invoice.service.js
const PDFDocument = require('pdfkit');
const Counter     = require('../models/counter.model');
const Invoice     = require('../models/invoice.model');
const Order       = require('../models/order.model');
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
        .text(formatMUR(item.unitPrice), 370, y, { width: 85,  align: 'right' })
        .text(formatMUR(item.total),    460,  y, { width: 75,  align: 'right' });
      y += 22;
    });

    // ── Totals ────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
    y += 12;

    if (invoice.discount > 0) {
      doc.fontSize(9).fillColor('#555')
        .text('Subtotal:',  350, y, { width: 100 })
        .text(formatMUR(invoice.subtotal), 460, y, { width: 75, align: 'right' });
      y += 18;
      doc.fillColor(RED)
        .text('Discount:',  350, y, { width: 100 })
        .text(`-${formatMUR(invoice.discount)}`, 460, y, { width: 75, align: 'right' });
      y += 18;
      doc.moveTo(350, y).lineTo(545, y).strokeColor(BORDER).stroke();
      y += 10;
    }

    doc.fontSize(13).fillColor(BRAND)
      .text('TOTAL:',              350, y, { width: 100 })
      .text(formatMUR(invoice.total), 460, y, { width: 75, align: 'right' });

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
