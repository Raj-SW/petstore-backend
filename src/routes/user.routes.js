const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/user.controller');
const { validateUpdateProfile, validateChangePassword } = require('../validators/user.validator');

const router = express.Router();

// All user routes require authentication
router.use(isAuthenticated);

// Get user profile
router.get('/me', getProfile);

// Update user profile
router.patch('/update-profile', validateUpdateProfile, updateProfile);

// Change password
router.patch('/change-password', validateChangePassword, changePassword);

// Delete account
router.delete('/delete-account', deleteAccount);

module.exports = router;
