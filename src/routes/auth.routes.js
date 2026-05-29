const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
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
router.post('/register', validateRegister, signup);
router.post('/login', validateLogin, login);
router.post('/logout', isAuthenticated, logout);
router.get('/me', isAuthenticated, getCurrentUser);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password', resetPassword);
router.patch('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

module.exports = router;
