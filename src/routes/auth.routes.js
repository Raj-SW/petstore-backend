const express = require('express');
const { isAuthenticated } = require('../middlewares/auth.middleware');
const {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
} = require('../controllers/auth.controller');
const { validateRegister, validateLogin } = require('../validators/auth.validator');

const router = express.Router();
router.post('/register', validateRegister, signup);
router.post('/login', validateLogin, login);
router.post('/logout', isAuthenticated, logout);
router.post('/forgot-password', forgotPassword);
router.patch('/reset-password', resetPassword);
router.patch('/verify-email', verifyEmail);

module.exports = router;
