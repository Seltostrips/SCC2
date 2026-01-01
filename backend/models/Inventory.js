const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  skuId: { type: String, required: true },
  skuName: { type: String },
  location: { type: String },
  
  // Detailed Counts Breakdown
  counts: {
    picking: { type: Number, default: 0 },
    bulk: { type: Number, default: 0 },
    nearExpiry: { type: Number, default: 0 },
    jit: { type: Number, default: 0 },
    damaged: { type: Number, default: 0 },
    totalIdentified: { type: Number, required: true } // Sum of above
  },

  // ODIN / System Data Breakdown
  odin: {
    minQuantity: { type: Number, default: 0 }, // "Quantity as per ODIN"
    blocked: { type: Number, default: 0 },     // "Blocked Quantity"
    maxQuantity: { type: Number, required: true } // Sum of above
  },

  auditResult: { 
    type: String, 
    enum: ['Match', 'Excess', 'Shortfall'],
    required: true 
  },
  
  status: { 
    type: String, 
    enum: ['auto-approved', 'pending-client', 'client-approved', 'client-rejected'],
    default: 'auto-approved' 
  },
  
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uniqueCode: { type: String },
  notes: { type: String },
  
  clientResponse: {
    action: String,
    comment: String
  },
  
  timestamps: {
    staffEntry: { type: Date, default: Date.now },
    clientResponse: Date,
    finalStatus: Date
  }
});

module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
