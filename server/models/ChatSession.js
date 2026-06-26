const mongoose = require('mongoose');

const chatSessionSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember',
    required: true,
    unique: true // One continuous chat history per profile
  },
  history: [
    {
      role: { type: String, enum: ['user', 'model'], required: true },
      parts: [
        { text: { type: String, required: true } }
      ],
      timestamp: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('ChatSession', chatSessionSchema);
