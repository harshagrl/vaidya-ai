const mongoose = require('mongoose');

const vectorChunkSchema = new mongoose.Schema({
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember',
    required: true,
    index: true
  },
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HealthRecord',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true,
    validate: { 
      validator: v => Array.isArray(v) && v.length > 0, 
      message: 'Embedding must be a non-empty array' 
    }
  },
  metadata: {
    type: { type: String, enum: ['PRESCRIPTION', 'LAB_REPORT'] },
    sourceImageUrl: { type: String }
  }
}, { timestamps: true });

module.exports = mongoose.model('VectorChunk', vectorChunkSchema);
