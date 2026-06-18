const mongoose = require('mongoose');
const { FIELD_TOKENS } = require('../config/constants');

// CONVENTION: Any String field below that Gemini Vision cannot read should be explicitly 
// set to FIELD_TOKENS.UNREADABLE rather than null/empty string, so the UI can highlight it.
const medicineSchema = new mongoose.Schema({
  medicineName: { type: String },
  dosage: { type: String },
  frequency: { type: String },
  duration: { type: String },
  doctorNotes: { type: String },
  confidenceScores: { type: Map, of: Number } // per-field confidence
});

// CONVENTION: Any String field below that Gemini Vision cannot read should be explicitly 
// set to FIELD_TOKENS.UNREADABLE rather than null/empty string, so the UI can highlight it.
const labTestSchema = new mongoose.Schema({
  testName: { type: String },
  value: { type: String },
  unit: { type: String },
  referenceRange: { type: String },
  isAbnormalFlag: { type: Boolean },
  confidenceScores: { type: Map, of: Number } // per-field confidence
});

const healthRecordSchema = new mongoose.Schema({
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true },
  type: { type: String, enum: ['PRESCRIPTION', 'LAB_REPORT'], required: true },
  sourceImageUrl: { type: String }, // Cloudinary URL
  
  // Specific to Prescriptions
  prescribedDate: { type: Date },
  prescribingDoctor: { type: String },
  medicines: [medicineSchema],

  // Specific to Lab Reports
  testDate: { type: Date },
  labTests: [labTestSchema]

}, { timestamps: true });

// Pre-save validation hook to ensure correct arrays are populated based on record type
healthRecordSchema.pre('save', function(next) {
  if (this.type === 'PRESCRIPTION') {
    if (!this.medicines || this.medicines.length === 0) {
      return next(new Error('A PRESCRIPTION must have at least one medicine.'));
    }
    if (this.labTests && this.labTests.length > 0) {
      return next(new Error('A PRESCRIPTION cannot have lab tests attached.'));
    }
  } else if (this.type === 'LAB_REPORT') {
    if (!this.labTests || this.labTests.length === 0) {
      return next(new Error('A LAB_REPORT must have at least one lab test.'));
    }
    if (this.medicines && this.medicines.length > 0) {
      return next(new Error('A LAB_REPORT cannot have medicines attached.'));
    }
  }
  next();
});

module.exports = mongoose.model('HealthRecord', healthRecordSchema);
