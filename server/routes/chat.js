const express = require('express');
const router = express.Router({ mergeParams: true });
const { sendMessage, getHistory } = require('../controllers/chatController');
const auth = require('../middleware/auth');

// Note: Mounted at /api/profiles/:profileId/chat
router.post('/', auth, sendMessage);
router.get('/', auth, getHistory);

module.exports = router;
