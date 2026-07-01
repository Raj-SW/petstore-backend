const Cart = require('../models/cart.model');
const Product = require('../models/product.model');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// Get user's cart
exports.getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ user: req.user.id })
      .populate('items.product', 'name price images quantity');

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

// Resolve a cart line's price + label. Returns { error } when the chosen
// variant is unavailable; price defaults to 0 when the product is absent
// (strict validation is deferred to order creation).
function resolveCartPricing(product, variantId) {
  if (!product) return { itemPrice: 0, variantLabel: null };
  if (variantId && product.hasVariants) {
    const v = product.variants.id(variantId);
    if (!v) return { error: 'Selected option is unavailable' };
    return { itemPrice: product.priceForVariant(variantId), variantLabel: v.label };
  }
  return { itemPrice: product.effectivePrice, variantLabel: null };
}

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, variantId = null, quantity } = req.body;

    // Look up product for price; strict validation is deferred to order creation
    // so concurrent carts don't collide and invalid references surface at checkout.
    const product = await Product.findById(productId);

    // Variant products require a variant selection.
    if (product?.hasVariants && !variantId) {
      return next(new AppError('Please select a size/option', 400));
    }

    const { itemPrice = 0, variantLabel = null, error } = resolveCartPricing(product, variantId);
    if (error) return next(new AppError(error, 400));

    // Get or create cart
    let cart = await Cart.findOne({ user: req.user.id });
    if (!cart) {
      cart = await Cart.create({ user: req.user.id });
    }

    // A line is identified by product + variant.
    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
        && String(item.variantId || '') === String(variantId || ''),
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      if (product) existingItem.price = itemPrice;
    } else {
      cart.items.push({
        product: productId,
        variantId,
        variantLabel,
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
    const { id: productId } = req.params;
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
    if (!product) {
      return next(new AppError('Product not found', 404));
    }
    if (product.quantity !== undefined && product.quantity < quantity) {
      return next(new AppError('Insufficient stock', 400));
    }

    // Update quantity
    cartItem.quantity = quantity;
    cartItem.price = product.effectivePrice;

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
    const { id: productId } = req.params;

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
      // No cart document yet — already effectively empty, nothing to clear
      return res.status(200).json({ success: true, data: { items: [] } });
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
