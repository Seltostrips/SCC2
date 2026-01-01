const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. ROBUST LOOKUP
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const cleanSku = req.params.skuId.trim();
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    if (!item && !isNaN(cleanSku)) {
       item = await ReferenceInventory.findOne({ skuId: Number(cleanSku) });
    }
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

// 2. GET CLIENTS BY LOCATION (FIXED: Fuzzy + Debug)
router.get('/clients-by-location', auth, async (req, res) => {
  try {
    const { location } = req.query;
    // Decode in case it comes in encoded (though express usually handles this)
    const cleanLocation = decodeURIComponent(location).trim();
    
    if (!cleanLocation) return res.json([]);

    console.log(`[DEBUG] Searching for clients in: "${cleanLocation}"`);

    // ROBUST QUERY STRATEGY:
    // 1. Locations Array: Check if ANY element matches case-insensitive regex
    // 2. MappedLocation String: Check if string contains the location
    const clients = await User.find({ 
        role: 'client', 
        $or: [
            // Matches ["Noida WH", "Delhi"] if search is "noida wh"
            { locations: { $elemMatch: { $regex: new RegExp(`^${cleanLocation}$`, 'i') } } },
            // Exact match fallback
            { locations: cleanLocation },
            // Legacy string match
            { mappedLocation: { $regex: cleanLocation, $options: 'i' } }
        ]
    }).select('name company uniqueCode locations mappedLocation');
    
    console.log(`[DEBUG] Found ${clients.length} clients for "${cleanLocation}"`);
    // Debug: print names found
    if (clients.length > 0) {
        console.log(`[DEBUG] Matches: ${clients.map(c => c.name).join(', ')}`);
    } else {
        // If 0 found, perform a "Wildcard" check to see if ANY clients exist at all
        // This helps diagnose if the issue is the query or the data
        const allClients = await User.countDocuments({ role: 'client' });
        console.log(`[DEBUG] Total Clients in DB: ${allClients} (but 0 matched location)`);
    }

    res.json(clients);
  } catch (err) {
    console.error('Client Search Error:', err);
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
    const entries = await Inventory.find(query).populate('staffId', 'name').sort({ 'timestamps.staffEntry': -1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 5. SUBMIT INVENTORY
router.post('/', auth, async (req, res) => {
  try {
    const { skuId, skuName, location, counts, odin, assignedClientId, notes } = req.body;

    const totalIdentified = 
        (Number(counts.picking)||0) + (Number(counts.bulk)||0) + (Number(counts.nearExpiry)||0) + 
        (Number(counts.jit)||0) + (Number(counts.damaged)||0);
    const maxSystemQty = (Number(odin.minQuantity)||0) + (Number(odin.blocked)||0);

    let auditResult = 'Match';
    if (totalIdentified > maxSystemQty) auditResult = 'Excess';
    else if (totalIdentified < maxSystemQty) auditResult = 'Shortfall';

    let status = 'auto-approved';
    if (auditResult !== 'Match') status = 'pending-client';

    const newEntry = new Inventory({
      skuId, skuName, location,
      counts: { ...counts, totalIdentified },
      odin: { ...odin, maxQuantity: maxSystemQty },
      auditResult, status,
      staffId: req.user.id,
      assignedClientId: (status === 'pending-client') ? assignedClientId : undefined,
      notes,
      timestamps: { staffEntry: new Date() }
    });

    await newEntry.save();
    
    const io = req.app.get('io');
    if (io && status === 'pending-client' && assignedClientId) {
       io.to('client').emit('new-discrepancy', { assignedClientId, skuId, auditResult });
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
