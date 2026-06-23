const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const morgan = require('morgan');
const { errorHandler, AppError } = require('./middlewares/errorHandler');
const logger = require('./utils/logger');
const { swaggerUi, specs } = require('./config/swagger');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const cartRoutes = require('./routes/cart.routes');
const orderRoutes = require('./routes/order.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');
const professionalRoutes = require('./routes/professional.routes');
const reviewRoutes = require('./routes/review.routes');
const petRoutes = require('./routes/pet.routes');
const searchRoutes = require('./routes/search.routes');
const contactRoutes = require('./routes/contact.routes');
const tipRoutes = require('./routes/tip.routes');
const advertRoutes = require('./routes/advert.routes');
const galleryRoutes = require('./routes/gallery.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const announcementRoutes = require('./routes/announcement.routes');
const newsletterRoutes = require('./routes/newsletter.routes');
const faqRoutes = require('./routes/faq.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const settingsRoutes = require('./routes/settings.routes');

const app = express();

// Trust Vercel/Render/Cloudflare proxy so rate-limiter and req.ip work correctly
app.set('trust proxy', 1);

// Health check — returns 200 so load balancers and uptime monitors don't 404
app.get('/', (req, res) => res.status(200).json({ status: 'ok', message: 'VitalPaws API is running' }));

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL,
      process.env.VERCEL_FRONTEND_URL,
      'http://localhost:5173',
      'http://localhost:4173',
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, curl, Postman, server-to-server)
    if (!origin) return callback(null, true);

    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
// Preflight must use the same config — not the open default
app.options('*', cors(corsOptions));

app.use(mongoSanitize());

// xss-clean irreversibly HTML-encodes JSON bodies, which would destroy the
// TipTap HTML stored in tip and gallery bodies. These mutations are admin-only
// and the frontend renders bodies exclusively through RichTextRenderer
// (DOMPurify), so we skip xss-clean for those create/update requests only.
const xssMiddleware = xss();
app.use((req, res, next) => {
  const isHtmlMutation =
    (req.path.startsWith('/api/tips') || req.path.startsWith('/api/gallery')) &&
    ['POST', 'PATCH', 'PUT'].includes(req.method);
  if (isHtmlMutation) return next();
  return xssMiddleware(req, res, next);
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Limit each IP to 300 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after a minute',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Apply rate limiting to all routes
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  limiter(req, res, next);
});

// Body parser
app.use(express.json({ limit: process.env.BODY_LIMIT || '200kb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.BODY_LIMIT || '200kb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev', { stream: logger.stream }));
}

// API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'PetStore API Documentation',
  })
);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/professionals', professionalRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/tips', tipRoutes);
app.use('/api/adverts', advertRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/settings', settingsRoutes);

// Handle unhandled routes
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error handling
app.use(errorHandler);

module.exports = app;
