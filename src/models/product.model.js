const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [100, 'Product name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    colors: [
      {
        type: String,
        trim: true,
      },
    ],
    quantity: {
      type: Number,
      required: [true, 'Quantity in stock is required'],
      min: [0, 'Quantity cannot be negative'],
      default: 0,
    },
    // Optional per-product low-stock threshold override (else the global default)
    lowStockThreshold: {
      type: Number,
      default: null,
      min: 0,
    },
    genders: [
      {
        type: String,
        enum: ['Male', 'Female', 'Unisex'],
        trim: true,
      },
    ],
    categories: [
      {
        type: String,
        required: [true, 'At least one category is required'],
        trim: true,
      },
    ],
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        publicId: {
          type: String,
          required: true,
        },
      },
    ],
    slug: {
      type: String,
      unique: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    onSale: {
      type: Boolean,
      default: false,
    },
    discountType: {
      type: String,
      enum: ['percent', 'amount'],
      default: 'percent',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    saleStartsAt: {
      type: Date,
      default: null,
    },
    saleEndsAt: {
      type: Date,
      default: null,
    },
    sections: [
      {
        title: { type: String, required: true, trim: true, maxlength: 100 },
        body:  { type: String, required: true },
        order: { type: Number, default: 0 },
      },
    ],
    variants: [
      {
        label:    { type: String, required: true, trim: true, maxlength: 40 },
        price:    { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 0, default: 0 },
        images: {
          type: [{ url: String, publicId: String }],
          default: [],
          validate: {
            validator: (arr) => arr.length <= 6,
            message: 'A variant can have at most 6 images',
          },
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Pre-save middleware to generate slug
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
  next();
});

// For variant products, derive the product-level price (lowest) and quantity
// (total stock) so price sort/filter and the card "From" price keep working.
// Must be pre('validate') because required-field validation runs before save hooks.
productSchema.pre('validate', function (next) {
  if (Array.isArray(this.variants) && this.variants.length > 0) {
    this.price = Math.min(...this.variants.map((v) => Number(v.price)));
    this.quantity = this.variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
  }
  next();
});

// Indexes for efficient querying
productSchema.index({ name: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ price: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ isFeatured: 1 });

// ── Sale pricing (one helper drives product-level + per-variant pricing) ──
const round2 = (n) => Math.round(n * 100) / 100;

function computeSale(basePrice, { onSale, discountType, discountValue, saleStartsAt, saleEndsAt }) {
  const price = Number(basePrice) || 0;
  let salePrice = null;
  if (discountValue && discountValue > 0) {
    if (discountType === 'amount') salePrice = round2(discountValue);
    else salePrice = round2(price * (1 - Math.min(100, Math.max(0, discountValue)) / 100));
  }
  let isOnSaleNow = false;
  if (onSale && salePrice != null && salePrice > 0 && salePrice < price) {
    const now = Date.now();
    const startOk = !saleStartsAt || now >= new Date(saleStartsAt).getTime();
    const endOk = !saleEndsAt || now <= new Date(saleEndsAt).getTime();
    isOnSaleNow = startOk && endOk;
  }
  const effectivePrice = isOnSaleNow ? salePrice : price;
  let discountPercentLabel = 0;
  if (isOnSaleNow) {
    discountPercentLabel = discountType === 'percent'
      ? Math.round(discountValue)
      : Math.round(((price - salePrice) / price) * 100);
  }
  return { salePrice, isOnSaleNow, effectivePrice, discountPercentLabel };
}

productSchema.virtual('salePrice').get(function () { return computeSale(this.price, this).salePrice; });
productSchema.virtual('isOnSaleNow').get(function () { return computeSale(this.price, this).isOnSaleNow; });
productSchema.virtual('effectivePrice').get(function () { return computeSale(this.price, this).effectivePrice; });
productSchema.virtual('discountPercentLabel').get(function () { return computeSale(this.price, this).discountPercentLabel; });

productSchema.virtual('hasVariants').get(function () {
  return Array.isArray(this.variants) && this.variants.length > 0;
});

productSchema.virtual('variantsView').get(function () {
  if (!this.hasVariants) return [];
  return this.variants.map((v) => {
    const s = computeSale(v.price, this);
    return {
      _id: v._id, label: v.label, quantity: v.quantity, price: v.price,
      images: Array.isArray(v.images) ? v.images : [],
      salePrice: s.salePrice, isOnSaleNow: s.isOnSaleNow,
      effectivePrice: s.effectivePrice, discountPercentLabel: s.discountPercentLabel,
    };
  });
});

productSchema.methods.priceForVariant = function (variantId) {
  const v = this.variants?.id(variantId);
  if (!v) return null;
  return computeSale(v.price, this).effectivePrice;
};

// Prevent OverwriteModelError in dev/hot-reload
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
