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

// Indexes for efficient querying
productSchema.index({ name: 1 });
productSchema.index({ slug: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ price: 1 });
productSchema.index({ quantity: 1 });
productSchema.index({ isFeatured: 1 });

// ── Sale pricing virtuals (derived live from the inputs; serialized via toJSON) ──
const round2 = (n) => Math.round(n * 100) / 100;

productSchema.virtual('salePrice').get(function () {
  if (!this.discountValue || this.discountValue <= 0) return null;
  if (this.discountType === 'amount') return round2(this.discountValue);
  const pct = Math.min(100, Math.max(0, this.discountValue));
  return round2(this.price * (1 - pct / 100));
});

productSchema.virtual('isOnSaleNow').get(function () {
  if (!this.onSale) return false;
  const sp = this.salePrice;
  if (sp == null || sp <= 0 || sp >= this.price) return false;
  const now = Date.now();
  if (this.saleStartsAt && now < new Date(this.saleStartsAt).getTime()) return false;
  if (this.saleEndsAt && now > new Date(this.saleEndsAt).getTime()) return false;
  return true;
});

productSchema.virtual('effectivePrice').get(function () {
  return this.isOnSaleNow ? this.salePrice : this.price;
});

productSchema.virtual('discountPercentLabel').get(function () {
  if (!this.isOnSaleNow) return 0;
  if (this.discountType === 'percent') return Math.round(this.discountValue);
  return Math.round(((this.price - this.salePrice) / this.price) * 100);
});

// Prevent OverwriteModelError in dev/hot-reload
module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
