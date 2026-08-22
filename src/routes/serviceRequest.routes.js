const express = require('express');
const rateLimit = require('express-rate-limit');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const {
  validateAppointmentRequest,
  validateMobileVetRequest,
  validateRequestUpdate,
  validateRequestNote,
} = require('../validators/serviceRequest.validator');
const {
  createAppointmentRequest,
  getAppointmentRequests,
  updateAppointmentRequest,
  addAppointmentRequestNote,
  deleteAppointmentRequest,
  createMobileVetRequest,
  getMobileVetRequests,
  updateMobileVetRequest,
  addMobileVetRequestNote,
  deleteMobileVetRequest,
} = require('../controllers/serviceRequest.controller');

const router = express.Router();

// These endpoints are unauthenticated and one of them accepts an image upload,
// so they get a tighter cap than the global 300/min limiter. Skipped under jest
// for the same reason as the global one (supertest shares a single IP).
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { status: 'error', message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// Public
router.post('/appointments', submitLimiter, validateAppointmentRequest, createAppointmentRequest);
router.post(
  '/mobile-vet',
  submitLimiter,
  upload.single('photo'),
  validateMobileVetRequest,
  createMobileVetRequest,
);

// Admin
const admin = [isAuthenticated, isAdmin];

router.get('/appointments/admin', admin, getAppointmentRequests);
router.patch('/appointments/:id', admin, validateRequestUpdate, updateAppointmentRequest);
router.post('/appointments/:id/notes', admin, validateRequestNote, addAppointmentRequestNote);
router.delete('/appointments/:id', admin, deleteAppointmentRequest);

router.get('/mobile-vet/admin', admin, getMobileVetRequests);
router.patch('/mobile-vet/:id', admin, validateRequestUpdate, updateMobileVetRequest);
router.post('/mobile-vet/:id/notes', admin, validateRequestNote, addMobileVetRequestNote);
router.delete('/mobile-vet/:id', admin, deleteMobileVetRequest);

module.exports = router;
