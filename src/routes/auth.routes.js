const express = require('express');

const router = express.Router();
const {
  signup,
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  getCurrentUser,
} = require('../controllers/auth.controller');
const {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../validators/auth.validator');
const { isAuthenticated } = require('../middlewares/auth.middleware');

// Public routes
router.post('/signup', validateRegister, signup);
router.post('/login', validateLogin, login);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password', validateResetPassword, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);
router.get('/me', getCurrentUser);

// Protected routes
router.post('/logout', isAuthenticated, logout);
router.post('/refresh-token', isAuthenticated, refreshToken);

module.exports = router;
