const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// ==========================================
// 1. ROBUST LOOKUP ROUTE (Fixes "SKU Not Found")
// ==========================================
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const rawSku = req.params.skuId;
    const cleanSku = rawSku.trim(); 
    
    console.log(`[DEBUG] Lookup Request: "${cleanSku}"`);

    // Strategy 1: Exact String Match
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    // Strategy 2: Try as Number (Fixes CSV import mismatches)
    if (!item && !isNaN(cleanSku)) {
       console.log('[DEBUG] Exact match failed. Trying as Number...');
       item = await ReferenceInventory.findOne({ skuId: Number(cleanSku) });
    }

    // Strategy 3: Case-Insensitive Regex (Fuzzy)
    if (!item) {
       console.log('[DEBUG] Trying Fuzzy Regex...');
       item = await ReferenceInventory.findOne({ 
        skuId: { $regex: new RegExp(`^${cleanSku}$`, 'i') } 
      });
    }

    if (!item) {
      console.log('❌ SKU Not Found in DB');
      return res.status(404).json({ message: 'SKU not found' });
    }
    
    console.log(`✅ Found SKU: ${item.skuId}`);
    res.json(item);
  } catch (err) {
    console.error('Lookup Error:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// 2. DASHBOARD DATA ROUTES (Fixes 404 Error)
// ==========================================

// [NEW] Get Staff History (This was MISSING in your file)
router.get('/staff-history', auth, async (req, res) => {
  try {
    // Show entries submitted by the logged-in staff member
    const entries = await Inventory.find({ staffId: req.user.id })
      .sort({ 'timestamps.staffEntry': -1 }); // Newest first

    res.json(entries);
  } catch (err) {
    console.error('Error fetching staff history:', err);
    res.status(500).send('Server Error');
  }
});

// [Restored] Get Pending Entries (For Client Dashboard)
router.get('/pending', auth, async (req, res) => {
  try {
    const query = { status: 'pending-client' };
    if (req.user.role === 'client') {
      query.assignedClientId = req.user.id;
    }
    const entries = await Inventory.find(query)
      .populate('staffId', 'name')
      .sort({ 'timestamps.staffEntry': -1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// [Restored] Get Clients by Location
router.get('/clients-by-location', auth, async (req, res) => {
  try {
    const { location } = req.query;
    const clients = await User.find({ role: 'client', mappedLocation: location });
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// 3. SUBMIT INVENTORY
// ==========================================
router.post('/', auth, async (req, res) => {
  try {
    const { 
      skuId, skuName, location, counts, odin, assignedClientId, notes
    } = req.body;

    console.log('Submitting Inventory:', skuId);

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
      notes, // Added notes support
      assignedClientId: (status === 'pending-client') ? assignedClientId : undefined,
      timestamps: { staffEntry: new Date() }
    });

    await newEntry.save();
    
    // Real-time Notification
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

module.exports = router;
