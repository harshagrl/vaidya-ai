const mongoose = require('mongoose');

const interactionsKBSchema = new mongoose.Schema({
  genericSaltA: { type: String, required: true, index: true },
  genericSaltB: { type: String, required: true, index: true },
  severity: { type: String, enum: ['Minor', 'Moderate', 'Severe/Contraindicated'], required: true },
  description: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('InteractionsKB', interactionsKBSchema);
