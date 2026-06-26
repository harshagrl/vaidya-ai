const mongoose = require('mongoose');

const medicineKBSchema = new mongoose.Schema({
  brandName: { type: String, required: true, index: true },
  genericComposition: { type: [String], required: true }, // Array of individual salts
  uses: { type: String },
  sideEffects: { type: String },
  embedding: {
    type: [Number],
    required: true,
    validate: { 
      validator: v => Array.isArray(v) && v.length > 0, 
      message: 'Embedding must be a non-empty array' 
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('MedicineKB', medicineKBSchema);
