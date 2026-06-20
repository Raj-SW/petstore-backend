const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const {
  getAdverts,
  getAdvertsAdmin,
  createAdvert,
  updateAdvert,
  deleteAdvert,
  uploadImage,
} = require('../controllers/advert.controller');
const { validateAdvert, validateAdvertUpdate } = require('../validators/advert.validator');

const router = express.Router();

// Public
router.get('/', getAdverts);

// Admin
router.get('/admin/all', isAuthenticated, isAdmin, getAdvertsAdmin);
router.post('/upload-image', isAuthenticated, isAdmin, upload.single('image'), uploadImage);
router.use(isAuthenticated, isAdmin);
router.post('/', validateAdvert, createAdvert);
router.patch('/:id', validateAdvertUpdate, updateAdvert);
router.delete('/:id', deleteAdvert);

module.exports = router;
