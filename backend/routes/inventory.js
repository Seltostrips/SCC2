const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); // Restored
const User = require('../models/User');
const auth = require('../middleware/auth');

// ==========================================
// 1. LOOKUP & UTILITY ROUTES (Restored & New)
// ==========================================

// [Restored] Lookup SKU (Old System)
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const skuId = req.params.skuId.trim();
    console.log(`Lookup SKU: "${skuId}"`);

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

// [Restored] Get Clients by Location (Old System)
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

// [New] Get Unique Codes (Required for NEW Staff Dashboard)
router.get('/unique-codes', auth, async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' }).select('company uniqueCode location');
    res.json(clients);
  } catch (err) {
    console.error('Error fetching unique codes:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// 2. DASHBOARD DATA ROUTES (Client & Staff)
// ==========================================

// [Updated] Get Pending Entries (For Client Dashboard)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Access denied. Clients only.' });
    }

    const clientUser = await User.findById(req.user.id);
    if (!clientUser || !clientUser.uniqueCode) {
      return res.status(400).json({ message: 'Client profile incomplete (missing Unique Code)' });
    }

    // Find items matching this client's code that are pending
    const pendingItems = await Inventory.find({
      status: 'pending-client',
      uniqueCode: clientUser.uniqueCode 
    })
    .populate('staffId', 'name')
    .sort({ 'timestamps.staffEntry': -1 });

    res.json(pendingItems);
  } catch (err) {
    console.error('Error fetching pending:', err);
    res.status(500).send('Server Error');
  }
});

// [New] Get Staff History (For Staff Dashboard - 3 Sections)
router.get('/staff-history', auth, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Access denied. Staff only.' });
    }

    const entries = await Inventory.find({ staffId: req.user.id })
      .sort({ 'timestamps.staffEntry': -1 });

    res.json(entries);
  } catch (err) {
    console.error('Error fetching staff history:', err);
    res.status(500).send('Server Error');
  }
});

// ==========================================
// 3. SUBMISSION ROUTES (Hybrid Logic)
// ==========================================

router.post('/', auth, async (req, res) => {
  try {
    // --- SCENARIO A: NEW SYSTEM (Bin ID / Book Qty) ---
    // This handles data coming from your current Staff Dashboard
    if (req.body.binId) {
        const { 
          binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode 
        } = req.body;

        console.log(`Submitting (Bin System): Bin ${binId} for Client ${uniqueCode}`);

        const discrepancy = Math.abs(bookQuantity - actualQuantity);

        let status = 'auto-approved';
        if (discrepancy > 0) status = 'pending-client';

        // Link Client ID if possible
        const clientUser = await User.findOne({ uniqueCode });

        const newEntry = new Inventory({
          binId,
          bookQuantity,
          actualQuantity,
          notes,
          location,
          uniqueCode,
          pincode,
          discrepancy,
          status,
          staffId: req.user.id,
          clientId: clientUser ? clientUser._id : undefined,
          timestamps: { staffEntry: new Date() }
        });

        await newEntry.save();
        return res.json(newEntry);
    } 
    
    // --- SCENARIO B: OLD SYSTEM (SKU / ODIN) ---
    // This handles data if you have an older page sending "skuId" and "counts"
    else if (req.body.skuId) {
        const { 
          skuId, skuName, location, counts, odin, assignedClientId 
        } = req.body;

        console.log('Submitting (SKU System):', skuId, location);

        // Old Audit Logic
        let auditResult = 'Match';
        if (counts.totalIdentified > odin.maxQuantity) auditResult = 'Excess';
        else if (counts.totalIdentified < odin.minQuantity) auditResult = 'Shortfall';

        let status = 'auto-approved';
        if (auditResult !== 'Match') status = 'pending-client';

        const newEntry = new Inventory({
          skuId,
          skuName,
          location,
          counts,
          odin,
          auditResult, // Note: Your schema might need to support this field if you use it
          status,
          staffId: req.user.id,
          assignedClientId: (status === 'pending-client') ? assignedClientId : undefined
        });

        await newEntry.save();
        return res.json(newEntry);
    }
    
    // Invalid Request
    else {
        return res.status(400).json({ message: 'Invalid submission data. Missing binId or skuId.' });
    }

  } catch (err) {
    console.error('Submit Error:', err);
    res.status(500).send(err.message || 'Server Error');
  }
});

// 4. RESPOND ROUTE (Client Action)
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const { action, comment } = req.body;
    const entryId = req.params.id;

    const entry = await Inventory.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    // Verify ownership
    const clientUser = await User.findById(req.user.id);
    if (entry.uniqueCode !== clientUser.uniqueCode) {
        return res.status(403).json({ message: 'Not authorized for this entry' });
    }

    if (action === 'approved') entry.status = 'client-approved';
    else if (action === 'rejected') entry.status = 'client-rejected';
    else return res.status(400).json({ message: 'Invalid action' });

    entry.clientResponse = { action, comment };
    entry.timestamps.clientResponse = new Date();
    entry.timestamps.finalStatus = new Date();

    await entry.save();
    res.json(entry);

  } catch (err) {
    console.error('Response Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
