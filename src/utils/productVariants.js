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

// Normalize a variant's optionValues (mongoose Map or plain object) to a plain object.
function toPlainOptionValues(ov) {
  if (!ov) return {};
  if (typeof ov.get === 'function') return Object.fromEntries(ov);
  return ov;
}

// Validate an option-matrix product: axes rules + every variant is a unique,
// fully specified combination of listed values. Returns an error message or null.
// Empty/absent options = legacy free-label variants, always valid here.
function validateOptionMatrix(options, variants) {
  const axes = Array.isArray(options) ? options : [];
  if (axes.length === 0) return null;
  if (axes.length > 4) return 'A product supports at most 4 option axes';

  const seenNames = new Set();
  for (const axis of axes) {
    const name = (axis.name || '').trim();
    if (!name) return 'Every option needs a name';
    const lower = name.toLowerCase();
    if (seenNames.has(lower)) return `Duplicate option name: ${name}`;
    seenNames.add(lower);
    const values = Array.isArray(axis.values)
      ? axis.values.map((v) => String(v).trim()).filter(Boolean)
      : [];
    if (values.length === 0) return `Option "${name}" needs at least one value`;
    if (new Set(values).size !== values.length) return `Option "${name}" has a duplicate value`;
  }

  const seenCombos = new Set();
  for (const variant of Array.isArray(variants) ? variants : []) {
    const ov = toPlainOptionValues(variant.optionValues);
    for (const axis of axes) {
      const value = ov[axis.name];
      if (value === undefined) return `Each variant must set every option (missing "${axis.name}")`;
      if (!axis.values.includes(value)) return `"${value}" is not a listed value of option "${axis.name}"`;
    }
    if (Object.keys(ov).length !== axes.length) return 'Each variant must set every option (no extra keys)';
    const key = axes.map((a) => ov[a.name]).join(' ');
    if (seenCombos.has(key)) return `Duplicate combination: ${axes.map((a) => ov[a.name]).join(' · ')}`;
    seenCombos.add(key);
  }
  return null;
}

// Overwrite each variant's label with the joined option values in axis order.
// No-op when the product has no option axes (legacy free-text labels).
function applyDerivedVariantLabels(options, variants) {
  const axes = Array.isArray(options) ? options : [];
  if (axes.length === 0) return;
  for (const variant of Array.isArray(variants) ? variants : []) {
    const ov = toPlainOptionValues(variant.optionValues);
    variant.label = axes.map((a) => ov[a.name]).join(' · ');
  }
}

module.exports = { deriveProductFromVariants, validateOptionMatrix, applyDerivedVariantLabels };
