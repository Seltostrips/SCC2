const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // For Admin
  password: { type: String }, // For Admin
  role: { 
    type: String, 
    enum: ['admin', 'staff', 'client'], 
    required: true 
  },
  
  // --- CRITICAL: LOGIN CREDENTIALS FOR STAFF/CLIENT ---
  uniqueCode: { type: String, unique: true, sparse: true }, // Matches "Staff ID"
  loginPin: { type: String }, // Matches "Login PIN"
  
  // --- LOCATION MAPPING ---
  // We keep 'mappedLocation' (string) for legacy support
  mappedLocation: { type: String }, 
  // We add 'locations' (array) for the new Multi-Location feature
  locations: { type: [String], default: [] }, 
  
  createdAt: { type: Date, default: Date.now }
});

// Admin Password Hash (Only hashes 'password' field, leaves PIN as plain text for CSV compatibility)
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper for Staff/Client PIN Login (Simple Text Match)
UserSchema.methods.matchPin = async function(enteredPin) {
  return enteredPin === this.loginPin;
};

// Helper for Admin Password Login (Bcrypt)
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
