// backend/src/routes/auth.routes.js
const express = require('express');
const {
  signup,
  login,
  logout,
  getCurrentUser,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
} = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../validators/auth.validator');

const router = express.Router();

// Public routes — no auth required
router.post('/signup', validateRegister, signup);   // was /register — matches frontend now
router.post('/login', validateLogin, login);
router.post('/logout', logout);                     // no isAuthenticated — JWT is stateless
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password', resetPassword);
router.patch('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

module.exports = router;
