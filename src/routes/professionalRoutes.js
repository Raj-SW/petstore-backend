const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createProfessionalSchema,
  updateProfessionalSchema,
  querySchema,
} = require('../validators/professionalValidator');
const { isAuthenticated } = require('../middlewares/auth.middleware');

// Public routes
router.get('/', validateRequest(querySchema, 'query'), professionalController.getAllProfessionals);
router.get('/available', professionalController.getAvailableProfessionals);
router.get('/role/:role', professionalController.getProfessionalsByRole);
router.get('/:id', professionalController.getProfessional);

// Protected routes (require authentication)
router.use(isAuthenticated);

// Admin only routes
router.post(
  '/',
  validateRequest(createProfessionalSchema),
  professionalController.createProfessional
);
router.patch(
  '/:id',
  validateRequest(updateProfessionalSchema),
  professionalController.updateProfessional
);
router.delete('/:id', professionalController.deleteProfessional);

module.exports = router;
