const express = require('express');
const { isAuthenticated, isAdmin } = require('../middlewares/auth.middleware');
const { validateSettingsUpdate } = require('../validators/settings.validator');
const { getSettings, updateSettings } = require('../controllers/settings.controller');

const router = express.Router();

// Public — checkout reads shipping/tax config
router.get('/', getSettings);

// Admin
router.patch('/', isAuthenticated, isAdmin, validateSettingsUpdate, updateSettings);

module.exports = router;
