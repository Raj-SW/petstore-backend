const bcrypt = require('bcryptjs');

const users = [
  {
    name: 'Admin User',
    email: 'admin@petstore.com',
    password: bcrypt.hashSync('Admin123!@#', 12),
    role: 'admin',
    isEmailVerified: true,
  },
  {
    name: 'John Doe',
    email: 'john@example.com',
    password: bcrypt.hashSync('User123!@#', 12),
    role: 'user',
    isEmailVerified: true,
  },
  {
    name: 'Jane Smith',
    email: 'jane@example.com',
    password: bcrypt.hashSync('User123!@#', 12),
    role: 'user',
    isEmailVerified: true,
  },
  {
    name: 'Dr. Sarah Wilson',
    email: 'sarah@petstore.com',
    password: bcrypt.hashSync('Vet123!@#', 12),
    role: 'vet',
    isEmailVerified: true,
  },
  {
    name: 'Mike Johnson',
    email: 'mike@petstore.com',
    password: bcrypt.hashSync('Groomer123!@#', 12),
    role: 'groomer',
    isEmailVerified: true,
  },
];

const categories = [
  {
    name: 'Dog Food',
    description: 'High-quality dog food and treats',
    image: 'dog-food.jpg',
  },
  {
    name: 'Cat Food',
    description: 'Premium cat food and treats',
    image: 'cat-food.jpg',
  },
  {
    name: 'Toys',
    description: 'Fun toys for pets',
    image: 'toys.jpg',
  },
  {
    name: 'Grooming',
    description: 'Pet grooming supplies',
    image: 'grooming.jpg',
  },
  {
    name: 'Health Care',
    description: 'Pet health and wellness products',
    image: 'health.jpg',
  },
];

const products = [
  {
    name: 'Premium Dog Food',
    description: 'High-quality dry dog food with balanced nutrition',
    price: 49.99,
    category: 'Dog Food',
    stock: 100,
    images: ['dog-food-1.jpg', 'dog-food-2.jpg'],
    specifications: {
      weight: '5kg',
      ingredients: ['Chicken', 'Rice', 'Vegetables'],
      ageGroup: 'Adult',
    },
  },
  {
    name: 'Cat Treats',
    description: 'Delicious treats for cats',
    price: 9.99,
    category: 'Cat Food',
    stock: 200,
    images: ['cat-treats-1.jpg'],
    specifications: {
      weight: '100g',
      ingredients: ['Tuna', 'Salmon'],
      ageGroup: 'All Ages',
    },
  },
  {
    name: 'Interactive Dog Toy',
    description: 'Durable interactive toy for dogs',
    price: 19.99,
    category: 'Toys',
    stock: 50,
    images: ['dog-toy-1.jpg'],
    specifications: {
      material: 'Rubber',
      size: 'Medium',
      ageGroup: 'All Ages',
    },
  },
  {
    name: 'Professional Grooming Kit',
    description: 'Complete grooming kit for pets',
    price: 79.99,
    category: 'Grooming',
    stock: 30,
    images: ['grooming-kit-1.jpg'],
    specifications: {
      contents: ['Brush', 'Scissors', 'Nail Clipper'],
      suitableFor: ['Dogs', 'Cats'],
    },
  },
  {
    name: 'Pet Vitamins',
    description: 'Essential vitamins for pet health',
    price: 29.99,
    category: 'Health Care',
    stock: 75,
    images: ['vitamins-1.jpg'],
    specifications: {
      type: 'Multivitamin',
      ageGroup: 'Adult',
      size: '60 tablets',
    },
  },
];

const appointments = [
  {
    userId: null, // Will be set dynamically
    serviceType: 'grooming',
    date: new Date('2024-03-20T10:00:00Z'),
    status: 'scheduled',
    petDetails: {
      name: 'Buddy',
      type: 'dog',
      breed: 'Golden Retriever',
      age: 3,
    },
    notes: 'Regular grooming session',
  },
  {
    userId: null, // Will be set dynamically
    serviceType: 'vet',
    date: new Date('2024-03-21T14:00:00Z'),
    status: 'scheduled',
    petDetails: {
      name: 'Luna',
      type: 'cat',
      breed: 'Siamese',
      age: 2,
    },
    notes: 'Annual checkup',
  },
];

const orders = [
  {
    userId: null, // Will be set dynamically
    items: [
      {
        productId: null, // Will be set dynamically
        quantity: 2,
        price: 49.99,
      },
    ],
    totalAmount: 99.98,
    status: 'completed',
    shippingAddress: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      country: 'USA',
    },
    paymentStatus: 'paid',
    paymentMethod: 'credit_card',
  },
  {
    userId: null, // Will be set dynamically
    items: [
      {
        productId: null, // Will be set dynamically
        quantity: 1,
        price: 19.99,
      },
    ],
    totalAmount: 19.99,
    status: 'processing',
    shippingAddress: {
      street: '456 Oak Ave',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90001',
      country: 'USA',
    },
    paymentStatus: 'pending',
    paymentMethod: 'paypal',
  },
];

module.exports = {
  users,
  categories,
  products,
  appointments,
  orders,
};
