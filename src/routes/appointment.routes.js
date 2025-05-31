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

const router = express.Router();

// Public routes to fetch appointments by professionalId or ownerId (number)
router.get('/professional/:professionalId', getAppointmentsByProfessional);
router.get('/owner/:ownerId', getAppointmentsByOwner);

// Public route to fetch all appointments
router.get('/', getAllAppointments);

// All appointment routes are now public (no authentication)
router.get('/my-appointments', getMyAppointments);
router.post('/', validateAppointment, createAppointment);
router.get('/:id', getAppointment);
router.patch('/:id/cancel', cancelAppointment);
router.get('/provider/appointments', getServiceProviderAppointments);
router.patch('/:id/status', updateAppointmentStatus);

module.exports = router;
