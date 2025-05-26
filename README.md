# PetStore Backend API

A comprehensive backend API for a pet store e-commerce platform with appointment booking functionality.

## Features

- User Authentication & Authorization
- Product Management
- Shopping Cart
- Order Management
- Appointment Booking System
- Payment Integration (Stripe & PayPal)
- Admin Dashboard
- Email Notifications

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- JWT Authentication
- Stripe & PayPal Integration
- Winston Logger
- Joi Validation

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/petstore-backend.git
cd petstore-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your environment variables (see `.env.example` for reference).

4. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication
- POST /api/auth/register - Register a new user
- POST /api/auth/login - Login user
- POST /api/auth/logout - Logout user
- POST /api/auth/forgot-password - Request password reset
- PATCH /api/auth/reset-password - Reset password

### Products
- GET /api/products - Get all products
- GET /api/products/:id - Get product by ID
- POST /api/products - Create new product (Admin)
- PATCH /api/products/:id - Update product (Admin)
- DELETE /api/products/:id - Delete product (Admin)

### Cart
- GET /api/cart - Get user's cart
- POST /api/cart - Add item to cart
- PATCH /api/cart/:id - Update cart item
- DELETE /api/cart/:id - Remove item from cart
- POST /api/cart/apply-discount - Apply discount code

### Orders
- GET /api/orders - Get user's orders
- GET /api/orders/:id - Get order by ID
- POST /api/orders - Create new order
- PATCH /api/orders/:id/status - Update order status (Admin)

### Appointments
- GET /api/appointments - Get user's appointments
- POST /api/appointments - Book new appointment
- PATCH /api/appointments/:id/status - Update appointment status
- DELETE /api/appointments/:id - Cancel appointment

### Payments
- POST /api/payments/create-intent - Create payment intent
- POST /api/payments/confirm - Confirm payment
- POST /api/payments/refund - Process refund (Admin)

### Admin Dashboard
- GET /api/admin/dashboard - Get dashboard statistics
- GET /api/admin/analytics/sales - Get sales analytics
- GET /api/admin/analytics/products - Get product analytics
- GET /api/admin/analytics/users - Get user analytics
- GET /api/admin/analytics/appointments - Get appointment analytics

## Error Handling

The API uses a centralized error handling mechanism with appropriate HTTP status codes and error messages.

## Security

- JWT Authentication
- Password Hashing
- Rate Limiting
- XSS Protection
- MongoDB Query Sanitization
- Helmet Security Headers

## Logging

The application uses Winston for logging with different log levels and file rotation.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License. 