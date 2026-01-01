const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); // <--- MUST BE HERE
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. LOOKUP ROUTE
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const skuId = req.params.skuId.trim(); // Trim spaces!
    console.log(`Lookup SKU: "${skuId}"`); // Check server logs

    const item = await ReferenceInventory.findOne({ skuId: skuId });
    
    if (!item) {
      console.log('SKU Not Found in DB');
      return res.status(404).json({ message: 'SKU not found' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('Lookup Error:', err);
    res.status(500).send('Server Error');
  }
});

// ... (Keep existing routes for clients-by-location, post /, pending, etc.) ...
// If you need the full file again, let me know, but this snippet is the critical fix.
// 2. GET CLIENTS BY LOCATION (For the dropdown)
router.get('/clients-by-location', auth, async (req, res) => {
  try {
    const { location } = req.query;
    // Find clients mapped to this location
    const clients = await User.find({ role: 'client', mappedLocation: location });
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 3. SUBMIT INVENTORY (New Logic with Counts & ODIN)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      skuId, skuName, location, counts, odin, assignedClientId 
    } = req.body;

    console.log('Submitting Inventory:', skuId, location);

    // Calculate Audit Result
    let auditResult = 'Match';
    if (counts.totalIdentified > odin.maxQuantity) auditResult = 'Excess';
    else if (counts.totalIdentified < odin.minQuantity) auditResult = 'Shortfall';

    // Determine Status
    let status = 'auto-approved';
    if (auditResult !== 'Match') status = 'pending-client';

    const newEntry = new Inventory({
      skuId,
      skuName,
      location,
      counts,
      odin,
      auditResult,
      status,
      staffId: req.user.id,
      assignedClientId: (status === 'pending-client') ? assignedClientId : undefined
    });

    await newEntry.save();
    res.json(newEntry);
  } catch (err) {
    console.error('Submit Error:', err);
    res.status(500).send('Server Error');
  }
});
module.exports = router;
