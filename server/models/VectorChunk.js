const mongoose = require('mongoose');

const vectorChunkSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true },
  recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthRecord', required: true },
  sourceType: { type: String, enum: ['medicine', 'labTest'], required: true },
  date: { type: Date },
  chunkText: { type: String, required: true }, // The prose string
  embedding: { type: [Number], required: true } // Array of floats, typical length 768 for text-embedding-004
}, { timestamps: true });

module.exports = mongoose.model('VectorChunk', vectorChunkSchema);
