const mongoose = require('mongoose');
const {
  users, categories, products, appointments, orders,
} = require('./mockData');
const User = require('../models/user');
const Category = require('../models/category');
const Product = require('../models/product');
const Appointment = require('../models/appointment');
const Order = require('../models/order');
const logger = require('../utils/logger');

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Appointment.deleteMany({}),
      Order.deleteMany({}),
    ]);
    logger.info('Cleared existing data');

    // Insert users
    const createdUsers = await User.insertMany(users);
    logger.info('Inserted users');

    // Insert categories
    const createdCategories = await Category.insertMany(categories);
    logger.info('Inserted categories');

    // Map category names to IDs
    const categoryMap = createdCategories.reduce((map, category) => {
      map[category.name] = category._id;
      return map;
    }, {});

    // Update products with category IDs
    const productsWithCategories = products.map((product) => ({
      ...product,
      category: categoryMap[product.category],
    }));

    // Insert products
    const createdProducts = await Product.insertMany(productsWithCategories);
    logger.info('Inserted products');

    // Update appointments with user IDs
    const appointmentsWithUsers = appointments.map((appointment, index) => ({
      ...appointment,
      userId: createdUsers[index + 1]._id, // Skip admin user
    }));

    // Insert appointments
    await Appointment.insertMany(appointmentsWithUsers);
    logger.info('Inserted appointments');

    // Update orders with user and product IDs
    const ordersWithReferences = orders.map((order, index) => ({
      ...order,
      userId: createdUsers[index + 1]._id, // Skip admin user
      items: order.items.map((item) => ({
        ...item,
        productId: createdProducts[0]._id, // Use first product for simplicity
      })),
    }));

    // Insert orders
    await Order.insertMany(ordersWithReferences);
    logger.info('Inserted orders');

    logger.info('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();
