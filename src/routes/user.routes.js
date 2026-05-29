const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  uploadAvatar,
} = require('../controllers/user.controller');
const { validateUpdateProfile, validateChangePassword } = require('../validators/user.validator');
const { upload } = require('../middlewares/upload');

const router = express.Router();

// All user routes require authentication
router.use(isAuthenticated);

// Get user profile
router.get('/me', getProfile);

// Update user profile
router.patch('/update-profile', validateUpdateProfile, updateProfile);

// Change password
router.patch('/change-password', validateChangePassword, changePassword);

// Upload avatar
router.patch('/upload-avatar', upload.single('avatar'), uploadAvatar);

// Delete account
router.delete('/delete-account', deleteAccount);

module.exports = router;
