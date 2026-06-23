/**
 * Email preview harness (Epic 10).
 * Renders every content template through `_layout.html` with representative
 * sample data into tmp/email-previews/<name>.html for visual QA.
 *
 *   node scripts/preview-emails.js
 */
const fs = require('fs');
const path = require('path');
const { renderTemplate } = require('../src/utils/email');

const OUT_DIR = path.join(__dirname, '../tmp/email-previews');
const TEMPLATES_DIR = path.join(__dirname, '../src/templates');

// Representative sample data per template (others fall back to a generic set).
const SAMPLES = {
  welcome: { name: 'Jane', shopUrl: 'https://vitalpaws.app/petshop' },
  'login-notification': { name: 'Jane', loginTime: '23 Jun 2026, 13:45', resetUrl: 'https://vitalpaws.app/reset-password' },
  'password-reset': { name: 'Jane', resetUrl: 'https://vitalpaws.app/reset-password/abc' },
  'email-verification': { name: 'Jane', verificationUrl: 'https://vitalpaws.app/verify-email/abc' },
  'contact-confirmation': { name: 'Jane' },
  'contact-admin': { name: 'Jane', email: 'jane@x.com', message: 'Do you ship to Rodrigues?', contactId: 'CT-1024' },
  'contact-reply': { name: 'Jane', message: 'Yes, we ship island-wide!', original: 'Do you ship to Rodrigues?' },
  'order-confirmation': { name: 'Jane', orderId: 'ORD-1024', totalAmount: 2450, items: [
    { product: { name: 'Premium Dog Food 5kg' }, quantity: 2, price: 900 },
    { product: { name: 'Chew Toy' }, quantity: 1, price: 650 },
  ] },
  'order-status-update': { name: 'Jane', orderId: 'ORD-1024', status: 'shipped' },
  'payment-status-update': { name: 'Jane', orderId: 'ORD-1024', paymentStatus: 'paid', amount: 2450 },
  'order-cancelled': { name: 'Jane', orderId: 'ORD-1024' },
  'payment-confirmation': { name: 'Jane', orderId: 'ORD-1024', amount: 2450, transactionId: 'TXN-77' },
  'refund-confirmation': { name: 'Jane', orderId: 'ORD-1024', amount: 2450, refundId: 'RF-12' },
  'sale-announcement': {
    name: 'Jane', subject: 'Winter Sale is live!', message: 'Up to 30% off selected items.',
    shopUrl: 'https://vitalpaws.app/petshop', unsubscribeUrl: 'https://vitalpaws.app/api/announcements/unsubscribe?t=1',
    products: [{ name: 'Premium Dog Food 5kg', image: '', priceLabel: 'Rs 900', salePriceLabel: 'Rs 630', discountLabel: '-30%', link: 'https://vitalpaws.app/product/1' }],
  },
  'subscription-reorder': {
    name: 'Jane', payUrl: 'https://vitalpaws.app/payment/1', subtotal: 'Rs 1,800', discountLabel: 'Rs 180', total: 'Rs 1,620',
    items: [{ name: 'Premium Dog Food 5kg', quantity: 2, lineTotal: 'Rs 1,800' }],
  },
  'appointment-request': { professionalName: 'Dr. Lee', userName: 'Jane', userEmail: 'jane@x.com', userPhone: '5123 4567', petName: 'Rex', date: '25 Jun 2026', time: '10:00', description: 'Annual checkup' },
  'appointment-confirmation': { userName: 'Jane', professionalName: 'Dr. Lee', petName: 'Rex', date: '25 Jun 2026', time: '10:00', description: 'Annual checkup' },
  appointmentStatusUpdate: { name: 'Jane', status: 'confirmed', serviceType: 'Vet', serviceProviderName: 'Dr. Lee', petName: 'Rex', date: '25 Jun 2026', timeSlot: { start: '10:00', end: '10:30' } },
  appointmentStatusUpdateCustomer: { recipientName: 'Jane', status: 'confirmed', vetName: 'Dr. Lee', petName: 'Rex', description: 'Annual checkup', address: 'Curepipe', dateTime: '25 Jun 2026, 10:00' },
  appointmentStatusUpdateProfessional: { recipientName: 'Dr. Lee', status: 'confirmed', customerName: 'Jane', petName: 'Rex', description: 'Annual checkup', address: 'Curepipe', dateTime: '25 Jun 2026, 10:00' },
};

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = fs.readdirSync(TEMPLATES_DIR)
    .filter((f) => f.endsWith('.html') && f !== '_layout.html')
    .map((f) => f.replace(/\.html$/, ''));

  let ok = 0;
  for (const name of names) {
    try {
      const html = renderTemplate(name, SAMPLES[name] || { name: 'Jane' });
      fs.writeFileSync(path.join(OUT_DIR, `${name}.html`), html);
      ok += 1;
    } catch (err) {
      console.error(`✗ ${name}: ${err.message}`);
    }
  }
  console.log(`Rendered ${ok}/${names.length} templates → ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
