const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PetStore Backend API',
      version: '1.0.0',
      description:
        'A comprehensive backend API for a pet store e-commerce platform with appointment booking functionality',
      contact: {
        name: 'API Support',
        email: 'support@petstore.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.petstore.com/api',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '6849dfefe9e5becc1dd84996',
            },
            name: {
              type: 'string',
              description: 'User full name',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
              example: 'john@example.com',
            },
            phoneNumber: {
              type: 'string',
              description: 'User phone number',
              example: '+1234567890',
            },
            address: {
              type: 'string',
              description: 'User address',
              example: '123 Main St, City, State',
            },
            role: {
              type: 'string',
              enum: ['customer', 'veterinarian', 'groomer', 'trainer', 'admin'],
              description: 'User role',
              example: 'customer',
            },
            professionalInfo: {
              type: 'object',
              description: 'Professional information (only for professionals)',
              properties: {
                specialization: {
                  type: 'string',
                  example: 'Small Animal Medicine',
                },
                qualifications: {
                  type: 'array',
                  items: { type: 'string' },
                  example: ['DVM', 'Board Certified'],
                },
                experience: {
                  type: 'number',
                  example: 10,
                },
                bio: {
                  type: 'string',
                  example: 'Experienced veterinarian specializing in small animals',
                },
                rating: {
                  type: 'number',
                  minimum: 0,
                  maximum: 5,
                  example: 4.5,
                },
                isActive: {
                  type: 'boolean',
                  example: true,
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Product: {
          type: 'object',
          required: ['name', 'price', 'category'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '6849dfefe9e5becc1dd84996',
            },
            name: {
              type: 'string',
              description: 'Product name',
              example: 'Premium Dog Food',
            },
            description: {
              type: 'string',
              description: 'Product description',
              example: 'High-quality nutrition for adult dogs',
            },
            price: {
              type: 'number',
              description: 'Product price',
              example: 29.99,
            },
            category: {
              type: 'string',
              description: 'Product category',
              example: 'food',
            },
            brand: {
              type: 'string',
              description: 'Product brand',
              example: 'PetNutrition',
            },
            stock: {
              type: 'number',
              description: 'Available stock',
              example: 100,
            },
            images: {
              type: 'array',
              items: { type: 'string' },
              description: 'Product image URLs',
            },
            rating: {
              type: 'number',
              minimum: 0,
              maximum: 5,
              example: 4.2,
            },
            isActive: {
              type: 'boolean',
              example: true,
            },
          },
        },
        Appointment: {
          type: 'object',
          required: ['professionalId', 'petId', 'serviceType', 'appointmentDate'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '6849dfefe9e5becc1dd84996',
            },
            userId: {
              type: 'string',
              description: 'Customer user ID',
              example: '6849dfefe9e5becc1dd84996',
            },
            professionalId: {
              type: 'string',
              description: 'Professional user ID',
              example: '6849dfefe9e5becc1dd84996',
            },
            petId: {
              type: 'string',
              description: 'Pet ID',
              example: '6849dfefe9e5becc1dd84996',
            },
            serviceType: {
              type: 'string',
              description: 'Type of service',
              example: 'General Checkup',
            },
            appointmentDate: {
              type: 'string',
              format: 'date-time',
              description: 'Appointment date and time',
            },
            status: {
              type: 'string',
              enum: ['pending', 'confirmed', 'completed', 'cancelled'],
              example: 'pending',
            },
            notes: {
              type: 'string',
              description: 'Additional notes',
            },
            price: {
              type: 'number',
              description: 'Service price',
              example: 75.0,
            },
          },
        },
        Pet: {
          type: 'object',
          required: ['name', 'species', 'breed'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '6849dfefe9e5becc1dd84996',
            },
            name: {
              type: 'string',
              description: 'Pet name',
              example: 'Buddy',
            },
            species: {
              type: 'string',
              description: 'Pet species',
              example: 'Dog',
            },
            breed: {
              type: 'string',
              description: 'Pet breed',
              example: 'Golden Retriever',
            },
            age: {
              type: 'number',
              description: 'Pet age in years',
              example: 3,
            },
            weight: {
              type: 'number',
              description: 'Pet weight in kg',
              example: 25.5,
            },
            color: {
              type: 'string',
              description: 'Pet color',
              example: 'Golden',
            },
            medicalHistory: {
              type: 'array',
              items: { type: 'string' },
              description: 'Medical history notes',
            },
            vaccinations: {
              type: 'array',
              items: { type: 'string' },
              description: 'Vaccination records',
            },
          },
        },
        Order: {
          type: 'object',
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '6849dfefe9e5becc1dd84996',
            },
            userId: {
              type: 'string',
              description: 'Customer user ID',
              example: '6849dfefe9e5becc1dd84996',
            },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  productId: { type: 'string' },
                  quantity: { type: 'number' },
                  price: { type: 'number' },
                },
              },
            },
            totalAmount: {
              type: 'number',
              description: 'Total order amount',
              example: 89.97,
            },
            status: {
              type: 'string',
              enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
              example: 'pending',
            },
            shippingAddress: {
              type: 'string',
              description: 'Shipping address',
            },
            paymentStatus: {
              type: 'string',
              enum: ['pending', 'paid', 'failed', 'refunded'],
              example: 'pending',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'Error message',
            },
            error: {
              type: 'string',
              example: 'Detailed error information',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js', './src/models/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  specs,
};
