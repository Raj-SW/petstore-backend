# VitalPaws Backend API

A comprehensive REST API for a pet store e-commerce platform with appointment booking, professional management, and admin tooling.

- **Base URL (local):** `http://localhost:5000/api`
- **Base URL (production):** `https://petstore-backend-five.vercel.app/api`
- **Interactive docs:** `http://localhost:5000/api-docs` (Swagger UI)

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Authentication](#authentication-flow)
- [API Reference](#api-reference)
  - [Auth](#auth-apiauthroute)
  - [Users](#users-apiusersroute)
  - [Products](#products-apiproductsroute)
  - [Cart](#cart-apicartroute)
  - [Orders](#orders-apiordersroute)
  - [Appointments](#appointments-apiappointmentsroute)
  - [Reviews](#reviews-apireviewsroute)
  - [Pets](#pets-apipetsroute)
  - [Professionals](#professionals-apiprofessionalsroute)
  - [Payments](#payments-apipaymentsroute)
  - [Search](#search-apisearchroute)
  - [Admin](#admin-apiadminroute)
- [Error Format](#error-format)
- [Security](#security)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 14 |
| Framework | Express.js |
| Database | MongoDB (Atlas) + Mongoose |
| Auth | JWT (Bearer token) |
| File uploads | Multer + Cloudinary |
| Payments | Stripe + PayPal (`@paypal/paypal-server-sdk`) |
| Email | Nodemailer + Handlebars templates |
| Validation | Joi |
| Logging | Winston |
| Docs | Swagger / OpenAPI |

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Copy `.env.example` to `.env` and fill in the values:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=<your MongoDB connection string>

# JWT
JWT_SECRET=<strong random string>
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=<strong random string>
JWT_REFRESH_EXPIRES_IN=30d

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<your Gmail address>
SMTP_PASS=<Gmail app password>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...

# Cloudinary
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Frontend
FRONTEND_URL=http://localhost:5173
CLIENT_URL=http://localhost:5173
```

### 3. Seed the database (optional)
```bash
npm run seed
```
Creates an admin user (`admin@petstore.com` / `Admin123!@#`) plus sample products, appointments, and orders.

### 4. Run the server
```bash
npm run dev      # development (nodemon)
npm start        # production
npm test         # Jest test suite
```

---

## Authentication Flow

The API uses **stateless JWT Bearer tokens**.

1. Call `POST /api/auth/login` → receive `data.accessToken`
2. Include the token on every protected request:
   ```
   Authorization: Bearer <accessToken>
   ```
3. Tokens expire per `JWT_EXPIRES_IN`. Use `POST /api/auth/forgot-password` to recover access.

**Role hierarchy:** `customer` → `veterinarian / groomer / trainer / petTaxi` (service providers) → `admin`

---

## API Reference

Legend: 🔓 Public · 🔐 Authenticated · 👑 Admin only · 🛠 Service provider only

---

### Auth `/api/auth/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/signup` | 🔓 | Register a new user account |
| POST | `/login` | 🔓 | Login — returns `{ user, accessToken }` |
| POST | `/logout` | 🔓 | Logout (client discards token) |
| POST | `/forgot-password` | 🔓 | Send password reset email |
| PATCH | `/reset-password` | 🔓 | Reset password with emailed token |
| PATCH | `/verify-email` | 🔓 | Verify email with emailed token |
| POST | `/resend-verification` | 🔓 | Resend verification email |

**POST /signup — Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phoneNumber": "59001234",
  "address": "123 Main St",
  "password": "StrongPass1*"
}
```

**POST /login — Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "...", "name": "...", "role": "customer", ... },
    "accessToken": "eyJ..."
  }
}
```

---

### Users `/api/users/<route>`

All routes require authentication.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/me` | 🔐 | Get own profile |
| PATCH | `/update-profile` | 🔐 | Update name, phone, address |
| PATCH | `/change-password` | 🔐 | Change password |
| PATCH | `/upload-avatar` | 🔐 | Upload profile picture (multipart `avatar` field) |
| DELETE | `/delete-account` | 🔐 | Permanently delete own account |

---

### Products `/api/products/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | 🔓 | List products (supports `?category`, `?minPrice`, `?maxPrice`, `?sort`, `?page`, `?limit`) |
| GET | `/category/:category` | 🔓 | Filter products by category slug |
| GET | `/analytics/overview` | 👑 | Product sales analytics |
| GET | `/:id` | 🔓 | Get single product |
| POST | `/` | 👑 | Create product (multipart, up to 10 images) |
| PATCH | `/:id` | 👑 | Update product (multipart) |
| DELETE | `/:id` | 👑 | Delete product |

---

### Cart `/api/cart/<route>`

All routes require authentication.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | 🔐 | Get current user's cart |
| POST | `/` | 🔐 | Add item — body: `{ productId, quantity }` |
| PATCH | `/:id` | 🔐 | Update item quantity — body: `{ quantity }` |
| DELETE | `/clear` | 🔐 | Remove all items from cart |
| DELETE | `/:id` | 🔐 | Remove a single cart item |
| POST | `/apply-discount` | 🔐 | Apply discount code — body: `{ discountCode }` |

---

### Orders `/api/orders/<route>`

All routes require authentication.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/` | 🔐 | Checkout — creates order from cart, decrements stock (transactional) |
| GET | `/my-orders` | 🔐 | List own orders (paginated) |
| GET | `/:id` | 🔐 | Get order details |
| PATCH | `/:id/cancel` | 🔐 | Cancel an order |
| GET | `/` | 👑 | List all orders (paginated, with filters) |
| PATCH | `/:id/status` | 👑 | Update order status (`pending` → `processing` → `shipped` → `delivered`) |
| PATCH | `/:id/payment` | 👑 | Update payment status |

**POST / — Request body:**
```json
{
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Port Louis",
    "state": "PL",
    "country": "Mauritius",
    "zipCode": "11101"
  },
  "paymentMethod": "stripe",
  "notes": "Leave at door"
}
```

---

### Appointments `/api/appointments/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/professional/:professionalId` | 🔓 | View a professional's public schedule |
| POST | `/` | 🔐 | Book an appointment |
| GET | `/my-appointments` | 🔐 | List own appointments |
| GET | `/professional-appointments` | 🛠 | List appointments for the logged-in professional |
| GET | `/:appointmentId` | 🔐 | Get appointment details |
| PATCH | `/:appointmentId/status` | 🔐 | Update status (`PENDING` → `CONFIRMED` / `CANCELLED` / `COMPLETED`) |
| DELETE | `/:appointmentId` | 🔐 | Cancel/delete appointment |

---

### Reviews `/api/reviews/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/:productId` | 🔐 | Submit a review for a product |
| GET | `/product/:productId` | 🔓 | Get all reviews for a product |
| PATCH | `/:id` | 🔐 | Edit own review |
| DELETE | `/:id` | 🔐 | Delete own review |

---

### Pets `/api/pets/<route>`

All routes require authentication.

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/` | 🔐 | Register a new pet |
| GET | `/` | 🔐 | List own pets |
| GET | `/:id` | 🔐 | Get pet details |
| PATCH | `/:id` | 🔐 | Update pet info |
| DELETE | `/:id` | 🔐 | Remove pet |

---

### Professionals `/api/professionals/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | 🔓 | List all professionals (query: `?role`, `?specialization`, `?page`, `?limit`) |
| GET | `/available` | 🔓 | List currently available professionals |
| GET | `/role/:role` | 🔓 | Filter by role (`veterinarian`, `groomer`, `trainer`, `petTaxi`) |
| GET | `/:id` | 🔓 | Get professional profile |
| PATCH | `/:id/profile` | 🛠 | Update own professional profile (owner only) |
| PATCH | `/:id/availability` | 🛠 | Set weekly availability schedule |
| PATCH | `/:id/status` | 🛠 | Toggle active/inactive status |
| PATCH | `/:id/rating` | 👑 | Override professional rating |
| PATCH | `/:id` | 👑 | Admin full profile update |

---

### Payments `/api/payments/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/webhook/stripe` | 🔓 | Stripe webhook receiver (raw body) |
| POST | `/webhook/paypal` | 🔓 | PayPal webhook receiver |
| POST | `/orders/:orderId/initialize` | 🔐 | Create payment intent for an order |
| POST | `/orders/:orderId/confirm` | 🔐 | Confirm/capture payment |
| POST | `/orders/:orderId/refund` | 🔐 | Process a refund |

---

### Search `/api/search/<route>`

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/products` | 🔓 | Full-text product search (`?q`, `?category`, `?minPrice`, `?maxPrice`, `?page`, `?limit`) |
| GET | `/suggestions` | 🔓 | Autocomplete suggestions (`?q`) |

---

### Admin `/api/admin/<route>`

All routes require authentication **and** `admin` role.

#### Dashboard & Analytics

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/dashboard` | Sales totals, recent orders, low-stock products, upcoming appointments |
| GET | `/analytics/sales` | Sales over time (`?period=daily\|weekly\|monthly`) |
| GET | `/analytics/products` | Top-selling products and category breakdown |
| GET | `/analytics/users` | User role breakdown and top spenders |
| GET | `/analytics/appointments` | Appointment trends and top providers (`?period=daily\|weekly\|monthly`) |

#### User Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/users` | Paginated user list (`?page`, `?limit` max 100, `?role`) |
| PATCH | `/users/:id/role` | Change a user's role |
| DELETE | `/users/:id` | Delete user + cascade (cart, reviews, pets, appointments, orders) |

#### Appointment Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/appointments` | All appointments (`?status`, `?page`, `?limit`) |

---

## Error Format

All errors follow this shape:

```json
{
  "status": "fail",
  "message": "Descriptive error message",
  "error": {
    "statusCode": 400,
    "status": "fail",
    "isOperational": true
  }
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Insufficient role |
| 404 | Resource not found |
| 429 | Rate limit exceeded (300 req/min per IP) |
| 500 | Internal server error |

---

## Security

| Measure | Detail |
|---------|--------|
| JWT auth | Bearer token, configurable expiry |
| Password hashing | bcrypt (12 rounds) |
| Rate limiting | 300 requests / minute / IP |
| XSS protection | `xss-clean` middleware |
| NoSQL injection | `express-mongo-sanitize` |
| Security headers | `helmet` |
| CORS | Restricted to configured `CLIENT_URL` origins |
| Body size limit | 10 KB (configurable via `BODY_LIMIT`) |
| Input validation | Joi schemas on all write endpoints |
