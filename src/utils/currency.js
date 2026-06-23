// The store is MUR-only. Single source of truth for formatting money so the app,
// emails, and invoices stay consistent (no stray "$").
function formatMUR(amount) {
  return `Rs ${Number(amount || 0).toLocaleString('en-US')}`;
}

module.exports = { formatMUR };
