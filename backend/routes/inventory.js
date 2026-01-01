const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. ROBUST LOOKUP
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const rawSku = req.params.skuId;
    const cleanSku = rawSku.trim(); 
    
    // Strategy 1: Exact
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    // Strategy 2: Number cast
    if (!item && !isNaN(cleanSku)) {
       item = await ReferenceInventory.findOne({ skuId: Number(cleanSku) });
    }

    // Strategy 3: Regex
    if (!item) {
       item = await ReferenceInventory.findOne({ 
        skuId: { $regex: new RegExp(`^${cleanSku}$`, 'i') } 
      });
    }

    if (!item) return res.status(404).json({ message: 'SKU not found' });
    res.json(item);
  } catch (err) {
    console.error('Lookup Error:', err);
    res.status(500).send('Server Error');
  }
});

// 2. GET CLIENTS BY LOCATION (For the Dropdown)
router.get('/clients-by-location', auth, async (req, res) => {
  try {
    const { location } = req.query;
    // Find clients where mappedLocation matches the requested location (case-insensitive)
    const clients = await User.find({ 
        role: 'client', 
        mappedLocation: { $regex: new RegExp(`^${location}$`, 'i') } 
    }).select('name company uniqueCode mappedLocation');
    
    res.json(clients);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 3. STAFF HISTORY
router.get('/staff-history', auth, async (req, res) => {
  try {
    const entries = await Inventory.find({ staffId: req.user.id })
      .sort({ 'timestamps.staffEntry': -1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 4. CLIENT PENDING
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

// 5. SUBMIT INVENTORY (Handles New Detailed Breakdown)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      skuId, skuName, location, counts, odin, assignedClientId, notes
    } = req.body;

    console.log('Submitting detailed entry for:', skuId);

    // Re-verify calculations server-side for safety
    const totalIdentified = 
        (counts.picking || 0) + (counts.bulk || 0) + (counts.nearExpiry || 0) + 
        (counts.jit || 0) + (counts.damaged || 0);
        
    const maxSystemQty = (odin.minQuantity || 0) + (odin.blocked || 0);

    let auditResult = 'Match';
    if (totalIdentified > maxSystemQty) auditResult = 'Excess';
    else if (totalIdentified < maxSystemQty) auditResult = 'Shortfall';

    let status = 'auto-approved';
    if (auditResult !== 'Match') status = 'pending-client';

    const newEntry = new Inventory({
      skuId,
      skuName,
      location,
      counts: { ...counts, totalIdentified },
      odin: { ...odin, maxQuantity: maxSystemQty },
      auditResult,
      status,
      staffId: req.user.id,
      assignedClientId: (status === 'pending-client') ? assignedClientId : undefined,
      notes,
      timestamps: { staffEntry: new Date() }
    });

    await newEntry.save();
    
    // Notification
    const io = req.app.get('io');
    if (io && status === 'pending-client' && assignedClientId) {
       io.to('client').emit('new-discrepancy', {
         assignedClientId, skuId, auditResult
       });
    }

    res.json(newEntry);
  } catch (err) {
    console.error('Submit Error:', err);
    res.status(500).send('Server Error');
  }
});

// 6. RESPOND
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const { action, comment } = req.body;
    const entry = await Inventory.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    if (entry.assignedClientId && entry.assignedClientId.toString() !== req.user.id) {
         return res.status(403).json({ message: 'Not authorized' });
    }

    if (action === 'approved') entry.status = 'client-approved';
    else if (action === 'rejected') entry.status = 'client-rejected';
    
    entry.clientResponse = { action, comment };
    entry.timestamps.clientResponse = new Date();
    await entry.save();
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
