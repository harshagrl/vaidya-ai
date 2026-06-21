const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getProfiles } = require('../controllers/profilesController');

// GET /api/profiles - Get all family members for the logged-in user
router.get('/', auth, getProfiles);

module.exports = router;
