const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // Admin uses this
  password: { type: String }, // Admin uses this
  role: { 
    type: String, 
    enum: ['admin', 'staff', 'client'], 
    required: true 
  },
  
  // --- CRITICAL: LOGIN CREDENTIALS FOR STAFF/CLIENT ---
  uniqueCode: { type: String, unique: true, sparse: true }, // Matches "Staff ID" column
  loginPin: { type: String }, // Matches "Login PIN" column
  
  // --- LOCATION MAPPING ---
  mappedLocation: { type: String }, // Keeps single string for backup
  locations: { type: [String], default: [] }, // New: Array of locations (Location1, Location2...)
  
  createdAt: { type: Date, default: Date.now }
});

// Admin Password Hash
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
