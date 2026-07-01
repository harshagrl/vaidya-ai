const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const { upload } = require('../utils/cloudinary');
const { parseDocument } = require('../controllers/uploadController');

// POST /api/upload/parse
// Requires auth token, expects 'document' file and 'type' field in formData
// Wraps multer in an explicit error handler so Cloudinary/multer failures
// return proper JSON errors instead of Express's default [object Object].
router.post('/parse', auth, (req, res, next) => {
  upload.single('document')(req, res, (err) => {
    if (err) {
      console.error('Multer/Cloudinary Upload Error:', err.message, err.stack);

      if (err instanceof multer.MulterError) {
        // Known multer error (e.g., file too large)
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      // Unknown error from Cloudinary or storage engine
      return res.status(500).json({ success: false, message: `Upload failed: ${err.message || 'Unknown error'}` });
    }
    // No error — proceed to the controller
    next();
  });
}, parseDocument);

module.exports = router;
