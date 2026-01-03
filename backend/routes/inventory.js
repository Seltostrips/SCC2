const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. ROBUST LOOKUP [CHANGE 2: Include Previous Submission Info]
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const cleanSku = req.params.skuId.trim();
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    // Fuzzy matching logic
    if (!item && !isNaN(cleanSku)) item = await ReferenceInventory.findOne({ skuId: Number(cleanSku) });
    if (!item) item = await ReferenceInventory.findOne({ skuId: { $regex: new RegExp(`^${cleanSku}$`, 'i') } });

    if (!item) return res.status(404).json({ message: 'SKU not found' });

    // [CHANGE 2] Check for ANY existing submission for this SKU
    const existingEntry = await Inventory.findOne({ skuId: item.skuId })
        .sort({ 'timestamps.staffEntry': -1 }) // Get latest
        .populate('staffId', 'name');

    const response = item.toObject();
    if (existingEntry) {
        response.previousSubmission = {
            staffName: existingEntry.staffId?.name || 'Unknown',
            time: existingEntry.timestamps.staffEntry,
            status: existingEntry.status
        };
    }

    res.json(response);
  } catch (err) {
    console.error('Lookup Error:', err);
    res.status(500).send('Server Error');
  }
});

// 2. GET CLIENTS BY LOCATION (Unchanged)
router.get('/clients-by-location', auth, async (req, res) => {
  try {
    const { location } = req.query;
    if (!location) return res.json([]);
    const cleanLocation = decodeURIComponent(location).trim();
    const regex = new RegExp(cleanLocation, 'i');

    const clients = await User.find({ 
        role: 'client', 
        $or: [
            { locations: { $elemMatch: { $regex: regex } } },
            { mappedLocation: { $regex: regex } }
        ]
    }).select('name company uniqueCode locations mappedLocation');
    
    res.json(clients);
  } catch (err) {
    console.error('Client Search Error:', err);
    res.status(500).send('Server Error');
  }
});

// 3. STAFF HISTORY [CHANGE 3: Show Unique Latest SKUs]
router.get('/staff-history', auth, async (req, res) => {
  try {
    // Aggregation to dedup SKUs and keep latest
    const entries = await Inventory.aggregate([
        // Filter by current staff user
        { $match: { staffId: new mongoose.Types.ObjectId(req.user.id) } },
        // Sort by date descending (Newest first)
        { $sort: { 'timestamps.staffEntry': -1 } },
        // Group by SKU, taking the first (latest) document found
        { $group: {
            _id: "$skuId",
            doc: { $first: "$$ROOT" }
        }},
        // Replace root to return clean documents
        { $replaceRoot: { newRoot: "$doc" } },
        // Sort the final list by date again
        { $sort: { 'timestamps.staffEntry': -1 } }
    ]);

    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 4. CLIENT PENDING (Unchanged)
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

// 5. SUBMIT INVENTORY (Unchanged)
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

// 6. RESPOND (Unchanged)
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
