const express = require('express');
const { protect } = require('../middlewares/auth');
const {
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
} = require('../controllers/user.controller');
const { validateUpdateProfile, validateChangePassword } = require('../validators/user.validator');

const router = express.Router();

// All user routes require authentication
router.use(protect);

// Get user profile
router.get('/me', getProfile);

// Update user profile
router.patch('/update-profile', validateUpdateProfile, updateProfile);

// Change password
router.patch('/change-password', validateChangePassword, changePassword);

// Delete account
router.delete('/delete-account', deleteAccount);

module.exports = router;
