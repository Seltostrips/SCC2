const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); // <--- This was missing
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. LOOKUP SKU ROUTE (Fixes "SKU Not Found" error)
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    console.log(`Searching for SKU: ${req.params.skuId}`); // Debug log
    const item = await ReferenceInventory.findOne({ skuId: req.params.skuId });
    
    if (!item) {
      console.log('SKU not found in DB');
      return res.status(404).json({ message: 'SKU not found' });
    }
    
    res.json(item);
  } catch (err) {
    console.error('Lookup Error:', err);
    res.status(500).send('Server Error');
  }
});

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
    
    // Real-time Notification (Socket.io)
    const io = req.app.get('io');
    if (io && status === 'pending-client' && assignedClientId) {
       io.to('client').emit('new-discrepancy', {
         assignedClientId: assignedClientId,
         skuId: skuId,
         auditResult: auditResult
       });
    }

    res.json(newEntry);
  } catch (err) {
    console.error('Submit Error:', err);
    res.status(500).send('Server Error');
  }
});

// 4. GET PENDING ENTRIES (For Client Dashboard)
router.get('/pending', auth, async (req, res) => {
  try {
    // If client, only show their specific assignments
    const query = { status: 'pending-client' };
    if (req.user.role === 'client') {
      query.assignedClientId = req.user.id;
    }
    
    const entries = await Inventory.find(query)
      .populate('staffId', 'name')
      .sort({ 'timestamps.entry': -1 });
      
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
