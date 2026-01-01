const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. GET UNIQUE CODES (For Staff Dropdown)
router.get('/unique-codes', auth, async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' }).select('company uniqueCode location');
    res.json(clients);
  } catch (err) {
    console.error('Error fetching unique codes:', err);
    res.status(500).send('Server Error');
  }
});

// 2. GET PENDING ENTRIES (For CLIENTS ONLY)
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'client') {
      return res.status(403).json({ message: 'Access denied. Clients only.' });
    }

    const clientUser = await User.findById(req.user.id);
    if (!clientUser || !clientUser.uniqueCode) {
      return res.status(400).json({ message: 'Client profile incomplete (missing Unique Code)' });
    }

    console.log(`Fetching pending items for Client Code: "${clientUser.uniqueCode}"`);

    const pendingItems = await Inventory.find({
      status: 'pending-client',
      uniqueCode: clientUser.uniqueCode 
    })
    .populate('staffId', 'name')
    .sort({ 'timestamps.staffEntry': -1 });

    console.log(`Found ${pendingItems.length} pending items.`);
    res.json(pendingItems);
  } catch (err) {
    console.error('Error fetching pending:', err);
    res.status(500).send('Server Error');
  }
});

// 3. GET STAFF HISTORY (New Route for the 3 Sections)
router.get('/staff-history', auth, async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Access denied. Staff only.' });
    }

    // Fetch all entries by this staff member
    const entries = await Inventory.find({ staffId: req.user.id })
      .sort({ 'timestamps.staffEntry': -1 });

    res.json(entries);
  } catch (err) {
    console.error('Error fetching staff history:', err);
    res.status(500).send('Server Error');
  }
});

// 4. SUBMIT INVENTORY (For Staff)
router.post('/', auth, async (req, res) => {
  try {
    const { 
      binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode 
    } = req.body;

    console.log(`Submitting: Bin ${binId} for Client ${uniqueCode}`);

    const discrepancy = Math.abs(bookQuantity - actualQuantity);

    // Determine Status
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
      timestamps: {
        staffEntry: new Date()
      }
    });

    await newEntry.save();
    res.json(newEntry);

  } catch (err) {
    console.error('Submit Error:', err);
    res.status(500).send(err.message || 'Server Error');
  }
});

// 5. RESPOND TO ENTRY (For Clients)
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

    if (action === 'approved') {
        entry.status = 'client-approved';
    } else if (action === 'rejected') {
        entry.status = 'client-rejected';
    } else {
        return res.status(400).json({ message: 'Invalid action' });
    }

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
