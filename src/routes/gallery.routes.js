const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload');
const {
  getPosts,
  getPost,
  getPostsAdmin,
  getPostAdmin,
  createPost,
  updatePost,
  deletePost,
  uploadImage,
} = require('../controllers/gallery.controller');
const { validateGalleryPost, validateGalleryPostUpdate } = require('../validators/gallery.validator');

const router = express.Router();

// Public routes
router.get('/', getPosts);

// Admin routes — registered before /:idOrSlug so "admin" isn't matched as a slug
router.get('/admin/all', isAuthenticated, isAdmin, getPostsAdmin);
router.get('/admin/:id', isAuthenticated, isAdmin, getPostAdmin);

// Admin image upload — declared before /:idOrSlug (POST, so no GET conflict, but kept explicit)
router.post('/upload-image', isAuthenticated, isAdmin, upload.single('image'), uploadImage);

router.get('/:idOrSlug', getPost);

// Admin mutations
router.use(isAuthenticated, isAdmin);
router.post('/', validateGalleryPost, createPost);
router.patch('/:id', validateGalleryPostUpdate, updatePost);
router.delete('/:id', deletePost);

module.exports = router;
