const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: [1, 'Quantity must be at least 1'],
          default: 1,
        },
        price: {
          type: Number,
          required: true,
        },
      },
    ],
    totalPrice: {
      type: Number,
      required: true,
      default: 0.0,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate total price before saving
cartSchema.pre('save', function (next) {
  this.totalPrice = this.items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
  next();
});

// Add item to cart
cartSchema.methods.addItem = async function (productId, quantity, price) {
  const itemIndex = this.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    // Update quantity if item exists
    this.items[itemIndex].quantity += quantity;
  } else {
    // Add new item
    this.items.push({ product: productId, quantity, price });
  }

  await this.save();
  return this;
};

// Remove item from cart
cartSchema.methods.removeItem = async function (productId) {
  this.items = this.items.filter(
    (item) => item.product.toString() !== productId.toString()
  );
  await this.save();
  return this;
};

// Update item quantity
cartSchema.methods.updateQuantity = async function (productId, quantity) {
  const itemIndex = this.items.findIndex(
    (item) => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    this.items[itemIndex].quantity = quantity;
    await this.save();
  }

  return this;
};

// Clear cart
cartSchema.methods.clear = async function () {
  this.items = [];
  this.totalPrice = 0;
  await this.save();
  return this;
};

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart; 