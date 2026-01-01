const mongoose = require('mongoose');

const ReferenceInventorySchema = new mongoose.Schema({
  skuId: { type: String, required: true, index: true }, // Removed 'unique' to prevent duplicate error crashes on dirty data
  name: { type: String, required: true },
  pickingLocation: { type: String },
  bulkLocation: { type: String },
  systemQuantity: { type: Number, required: true }
});

// Safe export to prevent "OverwriteModelError"
module.exports = mongoose.models.ReferenceInventory || mongoose.model('ReferenceInventory', ReferenceInventorySchema);
