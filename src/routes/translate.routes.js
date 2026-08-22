const express = require('express');
const { translate } = require('../controllers/translate.controller');

const router = express.Router();

// Public: the site's own language toggle calls this. Results are cached
// server-side so each distinct string costs one provider call, ever.
router.post('/', translate);

module.exports = router;
