const mongoose = require('mongoose');

// 1. Define the Schema FIRST
const InventorySchema = new mongoose.Schema({
  skuId: { type: String, required: true },
  skuName: { type: String, required: true },
  location: { type: String, required: true },
  
  // Detailed Counts
  counts: {
    picking: { type: Number, default: 0 },
    bulk: { type: Number, default: 0 },
    nearExpiry: { type: Number, default: 0 },
    jit: { type: Number, default: 0 },
    damaged: { type: Number, default: 0 },
    totalIdentified: { type: Number, required: true }
  },

  // ODIN Data
  odin: {
    minQuantity: { type: Number, default: 0 },
    blockedQuantity: { type: Number, default: 0 },
    maxQuantity: { type: Number, default: 0 }
  },

  // Results
  auditResult: {
    type: String,
    enum: ['Match', 'Excess', 'Shortfall'],
    required: true
  },
  
  // Workflow
  status: {
    type: String,
    enum: ['auto-approved', 'pending-client', 'client-approved', 'client-rejected'],
    default: 'pending-client'
  },
  
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  timestamps: {
    entry: { type: Date, default: Date.now },
    response: Date
  },
  clientResponse: { comment: String }
});

// 2. Export the Model AFTER the schema is defined
// The '||' check prevents the "OverwriteModelError" if the file is reloaded
module.exports = mongoose.models.Inventory || mongoose.model('Inventory', InventorySchema);
