const express = require('express');
// mergeParams is required because profileId comes from the parent router mapping in index.js
const router = express.Router({ mergeParams: true }); 
const auth = require('../middleware/auth');
const { createRecord } = require('../controllers/recordsController');

// POST /api/profiles/:profileId/records
router.post('/', auth, createRecord);

module.exports = router;
