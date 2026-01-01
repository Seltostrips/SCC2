const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true }, // Optional for staff/clients
  password: { type: String }, // Hashed password
  role: { 
    type: String, 
    enum: ['admin', 'staff', 'client'], 
    required: true 
  },
  
  // Login Credentials for Staff/Client
  uniqueCode: { type: String, unique: true, sparse: true }, // "Staff ID" or "Client Code"
  loginPin: { type: String }, // Simple PIN for easy login
  
  // Location Mapping
  // We keep 'mappedLocation' for legacy support, but 'locations' is the new standard
  mappedLocation: { type: String }, 
  locations: { type: [String], default: [] }, // Array of allowed locations
  
  createdAt: { type: Date, default: Date.now }
});

// Password Hash Middleware
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Helper to compare PINs (since they might be plain text in your CSV import)
UserSchema.methods.matchPin = async function(enteredPin) {
  return enteredPin === this.loginPin;
};

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
