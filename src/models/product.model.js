const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    rating: Number,
    price: Number,
    imageUrl: String,
    category: String,
    isFeatured: Boolean,
    isApparel: Boolean,
    stock: Number,
    slug: String,
  },
  { timestamps: true }
);

// Prevent OverwriteModelError in dev/hot-reload
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
