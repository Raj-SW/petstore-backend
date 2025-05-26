const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const {
  register,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} = require('../controllers/auth.controller');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../validators/auth.validator');

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Protected routes
router.post('/logout', protect, logout);
router.post('/refresh-token', refreshToken);

module.exports = router; 