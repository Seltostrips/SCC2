const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// ==========================================
// 1. LOOKUP & UTILITY ROUTES
// ==========================================

// [UPDATED] Lookup SKU (Deep Search: String, Number, & Fuzzy)
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const rawSku = req.params.skuId;
    const cleanSku = rawSku.trim(); 
    
    console.log(`[DEBUG] Lookup Request: "${cleanSku}"`);

    // Strategy 1: Exact String Match (Standard)
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    // Strategy 2: Try as Number (Common issue with CSV imports)
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

    // Strategy 4: Partial Match (Last Resort)
    if (!item) {
        console.log('[DEBUG] Trying Partial Match...');
        item = await ReferenceInventory.findOne({
            skuId: { $regex: cleanSku, $options: 'i' }
        });
    }

    if (!item) {
      console.log('❌ SKU Not Found in DB');
      
      // DEBUG: Print a sample of what IS in the DB to the console
      // This will help you see if your data is "SKU: 123" or just "123"
      const sample = await ReferenceInventory.findOne();
      if (sample) {
          console.log('--- DB SAMPLE ENTRY ---');
          console.log(`Saved SKU: "${sample.skuId}" (Type: ${typeof sample.skuId})`);
          console.log('-----------------------');
      }

      return res.status(404).json({ message: 'SKU not found in Reference Database (ODIN)' });
    }
    
    console.log(`✅ Found SKU: ${item.skuId}`);
    res.json(item);
  } catch (err) {
    console.error('Lookup Error:', err);
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

// [New] Get Unique Codes (Required for Staff Dashboard Dropdowns)
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
// 2. DASHBOARD DATA ROUTES
// ==========================================

// [Updated] Get Pending Entries (For Client Dashboard)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Access denied. Clients only.' });
    }

    const clientUser = await User.findById(req.user.id);
    // Support both old "location" and new "uniqueCode" logic
    const uniqueCode = clientUser.uniqueCode || 'N/A';

    const pendingItems = await Inventory.find({
      status: 'pending-client',
      // Match by uniqueCode OR by explicit clientId assignment
      $or: [
          { uniqueCode: uniqueCode },
          { clientId: clientUser._id }
      ]
    })
    .populate('staffId', 'name')
    .sort({ 'timestamps.staffEntry': -1 });

    res.json(pendingItems);
  } catch (err) {
    console.error('Error fetching pending:', err);
    res.status(500).send('Server Error');
  }
});

// [New] Get Staff History (For Staff Dashboard 3 Sections)
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
// 3. SUBMISSION ROUTES
// ==========================================

router.post('/', auth, async (req, res) => {
  try {
    // --- SCENARIO A: NEW SYSTEM (Bin ID) ---
    if (req.body.binId) {
        const { binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode } = req.body;
        
        console.log(`Submitting (Bin): ${binId}`);
        const discrepancy = Math.abs(bookQuantity - actualQuantity);
        
        let status = 'auto-approved';
        if (discrepancy > 0) status = 'pending-client';

        const clientUser = await User.findOne({ uniqueCode });

        const newEntry = new Inventory({
          binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode,
          discrepancy, status,
          staffId: req.user.id,
          clientId: clientUser ? clientUser._id : undefined,
          timestamps: { staffEntry: new Date() }
        });

        await newEntry.save();
        return res.json(newEntry);
    } 
    
    // --- SCENARIO B: OLD SYSTEM (SKU / ODIN) ---
    // This is what your Staff Dashboard is currently using
    else if (req.body.skuId) {
        const { skuId, skuName, location, counts, odin, assignedClientId } = req.body;

        console.log(`Submitting (SKU): ${skuId}`);

        // Logic: Compare Identified vs Max Quantity
        let auditResult = 'Match';
        if (counts.totalIdentified > odin.maxQuantity) auditResult = 'Excess';
        else if (counts.totalIdentified < odin.minQuantity) auditResult = 'Shortfall';

        let status = 'auto-approved';
        if (auditResult !== 'Match') status = 'pending-client';

        const newEntry = new Inventory({
          skuId, skuName, location, counts, odin, auditResult, status,
          staffId: req.user.id,
          // If assignedClientId is sent, use it. Otherwise undefined.
          clientId: assignedClientId || undefined,
          // IMPORTANT: Save uniqueCode if available, or "LEGACY" if not, to prevent crashes
          uniqueCode: req.body.uniqueCode || 'LEGACY', 
          pincode: req.body.pincode || '000000',
          timestamps: { staffEntry: new Date() }
        });

        await newEntry.save();
        return res.json(newEntry);
    }
    
    else {
        return res.status(400).json({ message: 'Invalid submission data.' });
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
    
    // Robust Ownership Check: Unique Code OR Client ID Match
    const isOwner = (entry.uniqueCode && entry.uniqueCode === clientUser.uniqueCode) || 
                    (entry.clientId && entry.clientId.toString() === req.user.id);

    if (!isOwner) {
         return res.status(403).json({ message: 'Not authorized' });
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
