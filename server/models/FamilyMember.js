const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  relationship: { type: String, required: true }, // e.g., 'Self', 'Parent', 'Spouse', 'Child'
  dateOfBirth: { type: Date },
  gender: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
