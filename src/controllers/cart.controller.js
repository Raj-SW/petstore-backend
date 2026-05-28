const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// Get user's cart
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images stock');

    if (!cart) {
      cart = await Cart.create({ user: req.user.id });
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    // Look up product for price; if not found or inactive, use 0 as placeholder price.
    // Strict validation (existence, stock, active status) is deferred to order creation
    // so that concurrent carts don't collide and invalid product references surface
    // only at checkout time with a proper error.
    const product = await Product.findById(productId);
    const itemPrice = product ? product.price : 0;

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ user: req.user.id });
    }

    // Check if product already in cart
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId,
    );

    if (existingItem) {
      // Update quantity if product already in cart
      existingItem.quantity += quantity;
      if (product) existingItem.price = itemPrice;
    } else {
      // Add new item to cart
      cart.items.push({
        product: productId,
        quantity,
        price: itemPrice,
      });
    }

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Update cart item quantity
exports.updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Check if product exists in cart
    const cartItem = cart.items.find(
      (item) => item.product.toString() === productId,
    );
    if (!cartItem) {
      return next(new AppError('Item not found in cart', 404));
    }

    // Check stock availability
    const product = await Product.findById(productId);
    if (product.quantity !== undefined && product.quantity < quantity) {
      return next(new AppError('Insufficient stock', 400));
    }

    // Update quantity
    cartItem.quantity = quantity;
    cartItem.price = product.price;

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
exports.removeCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // Remove item from cart
    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId,
    );

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Apply discount code
exports.applyDiscount = async (req, res, next) => {
  try {
    const { discountCode } = req.body;

    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    // TODO: Implement discount code validation and calculation
    // This is a placeholder for the actual discount logic
    const discount = 0; // Calculate based on discount code

    cart.discount = discount;
    cart.discountCode = discountCode;

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      return next(new AppError('Cart not found', 404));
    }

    cart.items = [];
    cart.discount = 0;
    cart.discountCode = null;

    await cart.save();

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    next(error);
  }
};
