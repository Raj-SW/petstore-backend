const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const {
  getTips,
  getTip,
  getTipsAdmin,
  getTipAdmin,
  createTip,
  updateTip,
  deleteTip,
} = require('../controllers/tip.controller');
const { validateTip, validateTipUpdate } = require('../validators/tip.validator');

const router = express.Router();

// Public routes
router.get('/', getTips);

// Admin routes — registered before /:idOrSlug so "admin" isn't matched as a slug
router.get('/admin/all', isAuthenticated, isAdmin, getTipsAdmin);
router.get('/admin/:id', isAuthenticated, isAdmin, getTipAdmin);

router.get('/:idOrSlug', getTip);

// Admin mutations
router.use(isAuthenticated, isAdmin);
router.post('/', validateTip, createTip);
router.patch('/:id', validateTipUpdate, updateTip);
router.delete('/:id', deleteTip);

module.exports = router;
