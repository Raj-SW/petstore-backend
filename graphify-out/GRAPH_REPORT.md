# Graph Report - backend/src  (2026-06-10)

## Corpus Check
- Corpus is ~28,426 words - fits in a single context window. You may not need a graph.

## Summary
- 728 nodes · 959 edges · 68 communities (38 shown, 30 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 68 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_App Bootstrap & Config|App Bootstrap & Config]]
- [[_COMMUNITY_Database Connection Layer|Database Connection Layer]]
- [[_COMMUNITY_Inventory Controller|Inventory Controller]]
- [[_COMMUNITY_Auth Controller|Auth Controller]]
- [[_COMMUNITY_Express App & Swagger|Express App & Swagger]]
- [[_COMMUNITY_Cross-Cutting Concerns|Cross-Cutting Concerns]]
- [[_COMMUNITY_Admin Dashboard|Admin Dashboard]]
- [[_COMMUNITY_Professional Controller|Professional Controller]]
- [[_COMMUNITY_Product Catalog Controller|Product Catalog Controller]]
- [[_COMMUNITY_File Upload Middleware|File Upload Middleware]]
- [[_COMMUNITY_Pet & Auth Middleware|Pet & Auth Middleware]]
- [[_COMMUNITY_API Route Definitions|API Route Definitions]]
- [[_COMMUNITY_Shopping Cart Controller|Shopping Cart Controller]]
- [[_COMMUNITY_Appointment Booking Controller|Appointment Booking Controller]]
- [[_COMMUNITY_Professional Service Layer|Professional Service Layer]]
- [[_COMMUNITY_Order Processing Controller|Order Processing Controller]]
- [[_COMMUNITY_User Data Model|User Data Model]]
- [[_COMMUNITY_Image Upload (Cloudinary)|Image Upload (Cloudinary)]]
- [[_COMMUNITY_Database Seeding|Database Seeding]]
- [[_COMMUNITY_User Service Layer|User Service Layer]]
- [[_COMMUNITY_Payment Controller|Payment Controller]]
- [[_COMMUNITY_Invoice & Billing Controller|Invoice & Billing Controller]]
- [[_COMMUNITY_Transaction Ledger|Transaction Ledger]]
- [[_COMMUNITY_Review System|Review System]]
- [[_COMMUNITY_Search & Discovery|Search & Discovery]]
- [[_COMMUNITY_Contact & Messaging|Contact & Messaging]]
- [[_COMMUNITY_Payment Service (Stripe)|Payment Service (Stripe)]]
- [[_COMMUNITY_PayPal Service|PayPal Service]]
- [[_COMMUNITY_Invoice Service (PDF)|Invoice Service (PDF)]]
- [[_COMMUNITY_Product Service Layer|Product Service Layer]]
- [[_COMMUNITY_Email Notification Utilities|Email Notification Utilities]]
- [[_COMMUNITY_Request Validation (Joi)|Request Validation (Joi)]]
- [[_COMMUNITY_Error Handling|Error Handling]]
- [[_COMMUNITY_Rate Limiting & Security|Rate Limiting & Security]]
- [[_COMMUNITY_Stock Movement Tracking|Stock Movement Tracking]]
- [[_COMMUNITY_Order Model|Order Model]]
- [[_COMMUNITY_Product Model|Product Model]]
- [[_COMMUNITY_Cart Model|Cart Model]]
- [[_COMMUNITY_Invoice Model|Invoice Model]]
- [[_COMMUNITY_Transaction Model|Transaction Model]]
- [[_COMMUNITY_Appointment Model|Appointment Model]]
- [[_COMMUNITY_Pet Model|Pet Model]]
- [[_COMMUNITY_Review Model|Review Model]]
- [[_COMMUNITY_Category Model|Category Model]]
- [[_COMMUNITY_Counter Model|Counter Model]]
- [[_COMMUNITY_Auth Validator|Auth Validator]]
- [[_COMMUNITY_Order Validator|Order Validator]]
- [[_COMMUNITY_Product Validator|Product Validator]]
- [[_COMMUNITY_User Validator|User Validator]]
- [[_COMMUNITY_Appointment Validator|Appointment Validator]]
- [[_COMMUNITY_Cart Validator|Cart Validator]]
- [[_COMMUNITY_Professional Validator|Professional Validator]]
- [[_COMMUNITY_Review Validator|Review Validator]]
- [[_COMMUNITY_Admin Validator|Admin Validator]]
- [[_COMMUNITY_Email Templates (Appointment)|Email Templates (Appointment)]]
- [[_COMMUNITY_Email Templates (Order)|Email Templates (Order)]]
- [[_COMMUNITY_Email Templates (Payment)|Email Templates (Payment)]]
- [[_COMMUNITY_Email Templates (Auth)|Email Templates (Auth)]]
- [[_COMMUNITY_Email Templates (Contact)|Email Templates (Contact)]]
- [[_COMMUNITY_Logger Utility|Logger Utility]]
- [[_COMMUNITY_Date Utilities|Date Utilities]]
- [[_COMMUNITY_Validation Utilities|Validation Utilities]]
- [[_COMMUNITY_Professional Routes|Professional Routes]]
- [[_COMMUNITY_Payment Routes|Payment Routes]]
- [[_COMMUNITY_Pet Routes|Pet Routes]]
- [[_COMMUNITY_Search Routes|Search Routes]]
- [[_COMMUNITY_User Routes|User Routes]]

## God Nodes (most connected - your core abstractions)
1. `AppError` - 36 edges
2. `Error Handler Middleware` - 17 edges
3. `Email Notification System` - 16 edges
4. `ValidationUtils` - 14 edges
5. `Order Controller` - 14 edges
6. `User Model` - 14 edges
7. `Admin Controller` - 12 edges
8. `Logger Utility` - 12 edges
9. `Logger (Winston)` - 12 edges
10. `Payment Controller` - 11 edges

## Surprising Connections (you probably didn't know these)
- `validateCreateOrder` --shares_data_with--> `Order Confirmation Email Template`  [INFERRED]
  backend/src/validators/order.validator.js → backend/src/templates/order-confirmation.html
- `validateUpdateOrderStatus` --shares_data_with--> `Order Status Update Email Template`  [INFERRED]
  backend/src/validators/order.validator.js → backend/src/templates/order-status-update.html
- `validatePaymentStatus` --shares_data_with--> `Payment Status Update Email Template`  [INFERRED]
  backend/src/validators/order.validator.js → backend/src/templates/payment-status-update.html
- `Winston Logger Config` --conceptually_related_to--> `Logger Utility`  [INFERRED]
  backend/src/config/logger.js → backend/src/utils/logger.js
- `validateRequest Middleware` --calls--> `AppError Class`  [INFERRED]
  backend/src/middlewares/validateRequest.js → backend/src/middlewares/errorHandler.js

## Hyperedges (group relationships)
- **Payment Processing Flow** — controller_payment, service_payment, service_paypal, model_order, model_invoice, model_transaction, service_invoice [INFERRED 0.95]
- **Order Lifecycle** — controller_cart, controller_order, controller_payment, model_cart, model_order, model_product, model_stockmovement [INFERRED 0.95]
- **Appointment Booking Flow** — controller_appointment, controller_professional, model_appointment, model_pet, model_user, validator_appointment, util_email [INFERRED 0.90]
- **Admin Analytics & Management** — controller_admin, controller_inventory, controller_invoice, controller_transaction, controller_contact, model_order, model_product, model_user, model_appointment [INFERRED 0.90]
- **Email Notification Pattern** — controller_auth, controller_appointment, controller_order, controller_payment, controller_contact, util_email [INFERRED 0.90]
- **Authentication Middleware Chain** — authmiddleware_isAuthenticated, authmiddleware_isAdmin, authmiddleware_isServiceProvider, errorhandler_AppError, user_model_User [EXTRACTED 1.00]
- **User-Referenced Models** — user_model_User, appointment_model_Appointment, cart_model_Cart, order_model_Order, pet_model_Pet, review_model_Review, invoice_model_Invoice, transaction_model_Transaction, stockmovement_model_StockMovement, category_model_Category, product_model_Product [EXTRACTED 1.00]
- **Product Ecosystem Models** — product_model_Product, cart_model_Cart, order_model_Order, review_model_Review, stockmovement_model_StockMovement, category_model_Category [INFERRED 0.95]
- **Payment & Financial Models** — order_model_Order, invoice_model_Invoice, transaction_model_Transaction, counter_model_Counter [INFERRED 0.85]
- **Admin Route Controller Dependencies** — admin_routes_adminRouter, authmiddleware_isAuthenticated, authmiddleware_isAdmin [EXTRACTED 1.00]
- **Payment Processing Stack (Stripe + PayPal)** — payment_service_paymentservice, paypal_service_paypalservice, payment_routes_paymentrouter, invoice_service_invoiceservice [INFERRED 0.85]
- **Routes Protected by Auth Middleware** — payment_routes_paymentrouter, pet_routes_petrouter, product_routes_productrouter, professional_routes_professionalrouter, review_routes_reviewrouter, user_routes_userrouter [EXTRACTED 1.00]
- **Joi-Based Request Validators** — admin_validator_validateanalyticsperiod, admin_validator_validatedaterange, appointment_validator_validateappointment, appointment_validator_validateappointmentstatus, appointment_validator_validatecancellation, auth_validator_validateregister, auth_validator_validatelogin, auth_validator_validateforgotpassword, auth_validator_validateresetpassword, cart_validator_validateaddtocart, cart_validator_validateupdatecartitem, cart_validator_validateapplydiscount [EXTRACTED 1.00]
- **User and Professional Data Layer** — userService_userservice, professionalService_professionalservice, userService_createuser, userService_getuserbyid, professionalService_getallprofessionals, professionalService_getavailableprofessionals [INFERRED 0.85]
- **Cloudinary Image Operations** — cloudinary_util_uploadtocloudinary, cloudinary_util_uploadmultipletocloudinary, cloudinary_util_deletefromcloudinary, cloudinary_util_deletemultiplefromcloudinary, cloudinary_util_validateimagefile [EXTRACTED 1.00]
- **Appointment Email Notification Flow** — template_appointment_confirmation, template_appointment_request, template_appointment_status, template_appointmentstatusupdate, template_appointmentstatusupdatecustomer, template_appointmentstatusupdateprofessional [INFERRED 0.95]
- **Order Email Notification Flow** — template_order_confirmation, template_order_cancelled, template_order_status_update [INFERRED 0.95]
- **Payment Email Notification Flow** — template_payment_confirmation, template_payment_status_update, template_refund_confirmation [INFERRED 0.95]
- **Request Validation Middleware Layer** — ordervalidator_validateCreateOrder, ordervalidator_validateUpdateOrderStatus, ordervalidator_validatePaymentStatus, productvalidator_validateProduct, productvalidator_validateProductUpdate, reviewvalidator_validateReview, uservalidator_validateUpdateProfile, uservalidator_validateChangePassword, professionalvalidator_updateProfessionalSchema, professionalvalidator_querySchema, professionalvalidator_availabilitySchema, professionalvalidator_ratingSchema [INFERRED 0.95]
- **Professional Schema Composition Chain** — professionalvalidator_availabilityDaySchema, professionalvalidator_availabilitySchema, professionalvalidator_serviceSchema, professionalvalidator_locationSchema, professionalvalidator_professionalInfoSchema, professionalvalidator_updateProfessionalSchema [EXTRACTED 1.00]

## Communities (68 total, 30 thin omitted)

### Community 0 - "App Bootstrap & Config"
Cohesion: 0.11
Nodes (42): Express App Entry Point, MongoDB Database Config, Winston Logger Config, Swagger API Docs Config, Admin Controller, Appointment Controller, Auth Controller, Cart Controller (+34 more)

### Community 1 - "Database Connection Layer"
Cohesion: 0.05
Nodes (33): logger, mongoose, { AppError }, Contact, filter, limit, logger, page (+25 more)

### Community 2 - "Inventory Controller"
Cohesion: 0.06
Nodes (29): { AppError }, enriched, filter, limit, newQty, note, page, page_data (+21 more)

### Community 3 - "Auth Controller"
Cohesion: 0.08
Nodes (29): { AppError }, bcrypt, crypto, forgotPassword(), generateTokens(), getCurrentUser(), jwt, logger (+21 more)

### Community 4 - "Express App & Swagger"
Cohesion: 0.06
Nodes (31): options, specs, swaggerJsdoc, swaggerUi, adminRoutes, app, appointmentRoutes, authRoutes (+23 more)

### Community 5 - "Cross-Cutting Concerns"
Cohesion: 0.10
Nodes (32): Email Notification System, Handlebars Templating, Joi Validation Pattern, AppError, validateCreateOrder, validatePaymentStatus, validateUpdateOrderStatus, validateProduct (+24 more)

### Community 6 - "Admin Dashboard"
Cohesion: 0.07
Nodes (28): affectedProductIds, { AppError }, Appointment, Cart, dateFormat, filter, { getStartDate, getDateFormat }, limit (+20 more)

### Community 7 - "Professional Controller"
Cohesion: 0.08
Nodes (24): { AppError }, filters, mongoose, pagination, professionalService, sorting, timeSlot, { createError } (+16 more)

### Community 8 - "Product Catalog Controller"
Cohesion: 0.07
Nodes (25): { AppError }, filter, keepImages, keepPublicIds, logger, mongoose, newlyUploaded, Product (+17 more)

### Community 9 - "File Upload Middleware"
Cohesion: 0.08
Nodes (23): { AppError }, multer, upload, {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getProductAnalytics,
}, express, { isAuthenticated, isAdmin }, router, { upload } (+15 more)

### Community 10 - "Pet & Auth Middleware"
Cohesion: 0.07
Nodes (21): { AppError }, Pet, { AppError }, decoded, jwt, User, mongoose, Pet (+13 more)

### Community 11 - "API Route Definitions"
Cohesion: 0.13
Nodes (25): Admin Routes, Appointment Model, Appointment Routes, Auth Routes, isAdmin Middleware, isAuthenticated Middleware, isServiceProvider Middleware, Cart Model (+17 more)

### Community 12 - "Shopping Cart Controller"
Cohesion: 0.10
Nodes (19): { AppError }, Cart, cartItem, existingItem, logger, Product, cartItemSchema, cartSchema (+11 more)

### Community 13 - "Appointment Booking Controller"
Cohesion: 0.09
Nodes (17): { AppError }, Appointment, { error }, logger, mongoose, Pet, query, { sendEmail } (+9 more)

### Community 14 - "Professional Service Layer"
Cohesion: 0.10
Nodes (21): ProfessionalService.getAllProfessionals, ProfessionalService.getAvailableProfessionals, ProfessionalService.getProfessionalById, ProfessionalService.getProfessionalsByRole, ProfessionalService, ProfessionalService.setProfessionalAvailability, ProfessionalService.toggleProfessionalStatus, ProfessionalService.updateProfessional (+13 more)

### Community 15 - "Order Processing Controller"
Cohesion: 0.10
Nodes (19): { AppError }, cancelMovements, Cart, Invoice, InvoiceService, limit, logDetails, logger (+11 more)

### Community 16 - "User Data Model"
Cohesion: 0.13
Nodes (10): bcrypt, jwt, mongoose, User, userSchema, { AppError }, mongoose, ProfessionalService (+2 more)

### Community 17 - "Image Upload (Cloudinary)"
Cohesion: 0.11
Nodes (18): deleteFromCloudinary, deleteMultipleFromCloudinary, uploadMultipleToCloudinary, uploadToCloudinary, renderTemplate, sendEmail, generateInvoice, generatePDF (+10 more)

### Community 18 - "Database Seeding"
Cohesion: 0.15
Nodes (14): appointments, bcrypt, categories, orders, products, users, Appointment, Category (+6 more)

### Community 19 - "User Service Layer"
Cohesion: 0.18
Nodes (6): { AppError }, bcrypt, mongoose, User, UserService, validateObjectId()

### Community 21 - "Invoice & Billing Controller"
Cohesion: 0.15
Nodes (8): { AppError }, {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  CheckoutPaymentIntent,
}, https, logger, ordersController, paymentsController, paypalClient, PayPalService

### Community 22 - "Transaction Ledger"
Cohesion: 0.19
Nodes (11): {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder,
  getMyOrders,
}, express, { getMyInvoice }, { isAuthenticated, isAdmin }, router, {
  validateCreateOrder,
  validateUpdateOrderStatus,
  validatePaymentStatus,
}, { AppError }, Joi (+3 more)

### Community 23 - "Review System"
Cohesion: 0.20
Nodes (9): { AppError }, filter, { generateInvoice, generatePDF }, Invoice, limit, Order, ownerId, page (+1 more)

### Community 24 - "Search & Discovery"
Cohesion: 0.20
Nodes (9): { AppError }, Invoice, InvoiceService, logger, Order, PaymentService, PayPalService, { sendEmail } (+1 more)

### Community 25 - "Contact & Messaging"
Cohesion: 0.20
Nodes (8): counterSchema, mongoose, Counter, generateInvoice(), generatePDF(), Invoice, Order, PDFDocument

### Community 26 - "Payment Service (Stripe)"
Cohesion: 0.22
Nodes (8): {
  createReview,
  getProductReviews,
  updateReview,
  deleteReview,
}, express, { isAuthenticated }, router, { validateReview }, { AppError }, Joi, validateReview()

### Community 27 - "PayPal Service"
Cohesion: 0.22
Nodes (4): { AppError }, logger, PaymentService, stripe

### Community 28 - "Invoice Service (PDF)"
Cohesion: 0.25
Nodes (5): AppError, errorHandler(), logger, { AppError }, mongoose

### Community 30 - "Email Notification Utilities"
Cohesion: 0.29
Nodes (6): allowedMimeTypes, { AppError }, b64, deletePromises, logger, uploadPromises

### Community 31 - "Request Validation (Joi)"
Cohesion: 0.33
Nodes (5): { AppError }, filter, limit, page, Transaction

### Community 32 - "Error Handling"
Cohesion: 0.40
Nodes (4): logFormat, loggerConfig, path, winston

### Community 33 - "Rate Limiting & Security"
Cohesion: 0.40
Nodes (4): { AppError }, bcrypt, {
  uploadMultipleToCloudinary,
  deleteMultipleFromCloudinary,
  validateImageFile,
}, User

### Community 34 - "Stock Movement Tracking"
Cohesion: 0.50
Nodes (3): invoiceSchema, lineItemSchema, mongoose

### Community 35 - "Order Model"
Cohesion: 0.50
Nodes (3): mongoose, orderItemSchema, orderSchema

### Community 36 - "Product Model"
Cohesion: 0.50
Nodes (3): { AppError }, Order, Review

### Community 37 - "Cart Model"
Cohesion: 0.67
Nodes (3): validateAppointment, validateAppointmentStatus, validateCancellation

### Community 39 - "Transaction Model"
Cohesion: 0.67
Nodes (3): Payment Router, PaymentService, PayPalService

## Knowledge Gaps
- **456 isolated node(s):** `express`, `cors`, `helmet`, `rateLimit`, `mongoSanitize` (+451 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `Invoice Service (PDF)` to `Database Connection Layer`, `Inventory Controller`, `Auth Controller`, `Express App & Swagger`, `Admin Dashboard`, `Professional Controller`, `Product Catalog Controller`, `File Upload Middleware`, `Pet & Auth Middleware`, `Shopping Cart Controller`, `Appointment Booking Controller`, `Order Processing Controller`, `User Data Model`, `User Service Layer`, `Invoice & Billing Controller`, `Transaction Ledger`, `Review System`, `Search & Discovery`, `Payment Service (Stripe)`, `PayPal Service`, `Email Notification Utilities`, `Request Validation (Joi)`, `Rate Limiting & Security`, `Product Model`?**
  _High betweenness centrality (0.147) - this node is a cross-community bridge._
- **Why does `ValidationUtils` connect `Payment Controller` to `Invoice Service (PDF)`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `Email Notification System` (e.g. with `Appointment Confirmation Email Template` and `Appointment Request Email Template`) actually correct?**
  _`Email Notification System` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `Order Controller` (e.g. with `Inventory Controller` and `Invoice Controller`) actually correct?**
  _`Order Controller` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `express`, `cors`, `helmet` to the rest of the system?**
  _456 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Bootstrap & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.10569105691056911 - nodes in this community are weakly interconnected._
- **Should `Database Connection Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.04994192799070848 - nodes in this community are weakly interconnected._