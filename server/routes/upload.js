const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const { parseDocument } = require('../controllers/uploadController');

// POST /api/upload/parse
// Requires auth token, expects 'document' file and 'type' field in formData
router.post('/parse', auth, upload.single('document'), parseDocument);

module.exports = router;
