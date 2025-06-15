const express = require('express');
const {
  searchProducts,
  getSuggestions,
} = require('../controllers/search.controller');

const router = express.Router();

// Public routes
router.get('/products', searchProducts);
router.get('/suggestions', getSuggestions);

module.exports = router;
