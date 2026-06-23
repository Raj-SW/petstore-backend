// Derive product-level price (lowest variant price) and quantity (sum of variant
// quantities) from a variants array. Mirrors the Product pre('validate') hook so
// update/inventory paths — which use findByIdAndUpdate and skip the hook — keep
// the product-level roll-up correct. Returns null when there are no variants.
function deriveProductFromVariants(variants) {
  const list = Array.isArray(variants) ? variants : [];
  if (list.length === 0) return null;
  return {
    price: Math.min(...list.map((v) => Number(v.price))),
    quantity: list.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0),
  };
}

module.exports = { deriveProductFromVariants };
