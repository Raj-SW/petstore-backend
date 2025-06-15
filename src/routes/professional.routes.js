const express = require('express');

const router = express.Router();
const professionalController = require('../controllers/professionalController');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  updateProfessionalSchema,
  querySchema,
  availabilitySchema,
  ratingSchema,
} = require('../validators/professionalValidator');
const { isAuthenticated, isServiceProvider, isAdmin } = require('../middlewares/auth.middleware');

// Public routes
router.get('/', validateRequest(querySchema, 'query'), professionalController.getAllProfessionals);
router.get('/available', professionalController.getAvailableProfessionals);
router.get('/role/:role', professionalController.getProfessionalsByRole);
router.get('/:id', professionalController.getProfessional);

// Protected routes (require authentication)
router.use(isAuthenticated);

// Professional self-management routes
router.patch(
  '/:id/profile',
  isServiceProvider,
  validateRequest(updateProfessionalSchema),
  professionalController.updateProfessional,
);

router.patch(
  '/:id/availability',
  isServiceProvider,
  validateRequest(availabilitySchema),
  professionalController.setProfessionalAvailability,
);

router.patch('/:id/status', isServiceProvider, professionalController.toggleProfessionalStatus);

// Admin and system routes
router.patch(
  '/:id/rating',
  isAdmin, // Only admin or system can update ratings directly
  validateRequest(ratingSchema),
  professionalController.updateProfessionalRating,
);

// General update route (for admin)
router.patch(
  '/:id',
  isAdmin,
  validateRequest(updateProfessionalSchema),
  professionalController.updateProfessional,
);

module.exports = router;
