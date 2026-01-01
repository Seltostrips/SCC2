const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  // Admin uses email/password
  email: { type: String, sparse: true }, 
  password: { type: String }, 
  
  // Staff/Client uses sccId/pin
  sccId: { type: String, unique: true, sparse: true }, 
  pin: { type: String }, 
  
  role: { type: String, enum: ['staff', 'client', 'admin'], required: true },
  
  // Change 2: Staff assignments (Array of strings)
  assignedLocations: [{ type: String }], 
  
  // Change 3: Client assignment (Single location per "Client Staff" login)
  mappedLocation: { type: String },      
  
  // Security & Logs
  isApproved: { type: Boolean, default: true },
  lastLogin: {
    timestamp: Date,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] }
    }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);


