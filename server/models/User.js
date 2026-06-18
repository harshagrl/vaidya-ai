const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  // Designed to be extensible for OTP later
  phone: { type: String, unique: true, sparse: true }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
