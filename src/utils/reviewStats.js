const Review = require('../models/review.model');

/**
 * Attach `ratingAvg` + `reviewCount` to a list of product documents using a
 * single aggregate, rather than one query per product.
 *
 * Products with no reviews come back as 0/0 so the client can hide the rating
 * row outright — a product with no reviews must not render as a bare 0 stars.
 *
 * Returns plain objects (via toJSON, so model transforms like `variantsView`
 * are preserved), because extra fields cannot be set on a Mongoose document.
 */
exports.attachReviewStats = async (products) => {
  if (!Array.isArray(products) || products.length === 0) return [];

  const rows = await Review.aggregate([
    { $match: { product: { $in: products.map((p) => p._id) } } },
    { $group: { _id: '$product', count: { $sum: 1 }, avg: { $avg: '$rating' } } },
  ]);

  const byProduct = new Map(rows.map((r) => [String(r._id), r]));

  return products.map((product) => {
    const stats = byProduct.get(String(product._id));
    const plain = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
    return {
      ...plain,
      reviewCount: stats ? stats.count : 0,
      // One decimal — cards show "4.9", not "4.857142857142857".
      ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
    };
  });
};
