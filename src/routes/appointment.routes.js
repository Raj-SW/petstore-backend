const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth');
const {
  createAppointment,
  getAppointments,
  getAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  getMyAppointments,
  getServiceProviderAppointments,
} = require('../controllers/appointment.controller');
const { validateAppointment } = require('../validators/appointment.validator');

const router = express.Router();

// All appointment routes require authentication
router.use(protect);

// Customer routes
router.get('/my-appointments', getMyAppointments);
router.post('/', validateAppointment, createAppointment);
router.get('/:id', getAppointment);
router.patch('/:id/cancel', cancelAppointment);

// Service provider routes (vet/groomer)
router.use(restrictTo('vet', 'groomer'));
router.get('/provider/appointments', getServiceProviderAppointments);
router.patch('/:id/status', updateAppointmentStatus);

module.exports = router; 