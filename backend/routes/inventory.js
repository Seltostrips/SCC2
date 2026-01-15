const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory'); 
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. ROBUST LOOKUP
router.get('/lookup/:skuId', auth, async (req, res) => {
  try {
    const cleanSku = req.params.skuId.trim();
    let item = await ReferenceInventory.findOne({ skuId: cleanSku });
    
    if (!item && !isNaN(cleanSku)) item = await ReferenceInventory.findOne({ skuId: Number(cleanSku) });
    if (!item) item = await ReferenceInventory.findOne({ skuId: { $regex: new RegExp(`^${cleanSku}$`, 'i') } });

    if (!item) return res.status(404).json({ message: 'SKU not found' });

    const existingEntry = await Inventory.findOne({ skuId: item.skuId })
        .sort({ 'timestamps.staffEntry': -1 })
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

// 2. GET CLIENTS BY LOCATION
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

// 3. STAFF HISTORY
router.get('/staff-history', auth, async (req, res) => {
  try {
    const entries = await Inventory.aggregate([
        { $match: { staffId: new mongoose.Types.ObjectId(req.user.id) } },
        { $sort: { 'timestamps.staffEntry': -1 } },
        { $group: {
            _id: "$skuId",
            doc: { $first: "$$ROOT" }
        }},
        { $replaceRoot: { newRoot: "$doc" } },
        { $sort: { 'timestamps.staffEntry': -1 } }
    ]);

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

// 5. SUBMIT INVENTORY (UPDATED LOGIC)
router.post('/', auth, async (req, res) => {
  try {
    const { skuId, skuName, location, counts, odin, assignedClientId, notes } = req.body;

    const totalIdentified = 
        (Number(counts.picking)||0) + (Number(counts.bulk)||0) + (Number(counts.nearExpiry)||0) + 
        (Number(counts.jit)||0) + (Number(counts.damaged)||0);
    
    // Updated Logic Variables
    const minQty = Number(odin.minQuantity) || 0;
    const blockedQty = Number(odin.blocked) || 0;
    const maxQty = minQty + blockedQty;

    let auditResult = 'Match';
    
    // [Calculation 2] Shortfall
    if (totalIdentified < minQty) {
        auditResult = 'Shortfall';
    } 
    // [Calculation 3] Excess
    else if (totalIdentified > maxQty) {
        auditResult = 'Excess';
    } 
    // [Calculation 1] Match (Default) covers minQty <= total <= maxQty

    let status = 'auto-approved';
    if (auditResult !== 'Match') status = 'pending-client';

    const newEntry = new Inventory({
      skuId, skuName, location,
      counts: { ...counts, totalIdentified },
      odin: { ...odin, maxQuantity: maxQty }, // Storing Max Sum in DB for ref
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
