const express = require('express');
const {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getMyAppointments,
  getServiceProviderAppointments,
  getAppointmentsByProfessional,
  getAppointmentsByOwner,
  getAllAppointments,
} = require('../controllers/appointment.controller');
const { validateAppointment } = require('../validators/appointment.validator');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');

const router = express.Router();

// Appointment Routes
// Public: GET /professional/:professionalId
// Protected (isAuthenticated): POST /, GET /my-appointments, GET /:id, PATCH /:id/status, PATCH /:id/cancel, GET /owner/:ownerId, GET /provider/appointments
// Admin-only: GET /

// Public routes to fetch appointments by professionalId or ownerId (number)
router.get('/professional/:professionalId', getAppointmentsByProfessional);
router.get('/owner/:ownerId', getAppointmentsByOwner);

// Public route to fetch all appointments
router.get('/', getAllAppointments);

// Protected routes
router.post('/', isAuthenticated, validateAppointment, createAppointment);
router.get('/my-appointments', isAuthenticated, getMyAppointments);
router.get('/:id', isAuthenticated, getAppointment);
router.patch('/:id/status', isAuthenticated, updateAppointmentStatus);
router.patch('/:id/cancel', isAuthenticated, cancelAppointment);
router.get('/provider/appointments', isAuthenticated, getServiceProviderAppointments);

module.exports = router;
