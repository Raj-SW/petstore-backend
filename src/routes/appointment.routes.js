const express = require('express');

const router = express.Router();
const {
  createAppointment,
  getUserAppointments,
  getProfessionalAppointments,
  getAppointmentById,
  updateAppointmentStatus,
  deleteAppointment,
  getPublicProfessionalAppointments,
} = require('../controllers/appointment.controller');
const { isAuthenticated, isServiceProvider } = require('../middlewares/auth.middleware');

// Public route for getting professional's appointments
router.get('/professional/:professionalId', getPublicProfessionalAppointments);

// All routes require authentication
router.use(isAuthenticated);

// Create a new appointment (customers only)
router.post('/', isAuthenticated, createAppointment);

// Get all appointments for the logged-in user (customers)
router.get('/my-appointments', isAuthenticated, getUserAppointments);

// Get professional's appointments (professionals only)
router.get('/professional-appointments', isServiceProvider, getProfessionalAppointments);

// Get a specific appointment by ID
router.get('/:appointmentId', getAppointmentById);

// Update appointment status
router.patch('/:appointmentId/status', updateAppointmentStatus);

// Cancel/Delete an appointment
router.delete('/:appointmentId', deleteAppointment);

module.exports = router;
