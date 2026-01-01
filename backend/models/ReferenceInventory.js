const mongoose = require('mongoose');

const ReferenceInventorySchema = new mongoose.Schema({
  skuId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  pickingLocation: { type: String },
  bulkLocation: { type: String },
  systemQuantity: { type: Number, required: true } // "Quantity as on date of Sampling"
});

module.exports = mongoose.model('ReferenceInventory', ReferenceInventorySchema);
