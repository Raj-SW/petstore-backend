const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const { validateRequest } = require('../middlewares/validateRequest');
const {
  createProfessionalSchema,
  updateProfessionalSchema,
  querySchema,
} = require('../validators/professionalValidator');
const { protect, restrictTo } = require('../middlewares/auth');

// Public routes
router.get('/', validateRequest(querySchema, 'query'), professionalController.getAllProfessionals);
router.get('/available', professionalController.getAvailableProfessionals);
router.get('/role/:role', professionalController.getProfessionalsByRole);
router.get('/:id', professionalController.getProfessional);

// Protected routes (require authentication)
router.use(protect);

// Admin only routes
router.use(restrictTo('admin'));

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
