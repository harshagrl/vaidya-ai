const express = require('express');
const router = express.Router({ mergeParams: true });
const { sendMessage, getHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

// Note: Mounted at /api/profiles/:profileId/chat
router.post('/', protect, sendMessage);
router.get('/', protect, getHistory);

module.exports = router;
