const express = require('express');
const router = express.Router();
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 1. GET UNIQUE CODES (Used by Staff Dashboard dropdown)
// Matches axios.get('/api/inventory/unique-codes')
router.get('/unique-codes', auth, async (req, res) => {
  try {
    // Return clients with their code and location
    const clients = await User.find({ role: 'client' })
      .select('company uniqueCode location');
    res.json(clients);
  } catch (err) {
    console.error('Error fetching unique codes:', err);
    res.status(500).send('Server Error');
  }
});

// 2. GET PENDING ENTRIES (Used by Client Dashboard)
// Matches axios.get('/api/inventory/pending')
router.get('/pending', auth, async (req, res) => {
  try {
    // SCENARIO A: CLIENT LOGGED IN
    // Find items matching their uniqueCode
    if (req.user.role === 'client') {
      const clientUser = await User.findById(req.user.id);
      
      if (!clientUser || !clientUser.uniqueCode) {
        return res.status(400).json({ message: 'Client profile incomplete' });
      }

      const pendingItems = await Inventory.find({
        status: 'pending-client',
        uniqueCode: clientUser.uniqueCode 
      })
      .populate('staffId', 'name') // Show staff name
      .sort({ 'timestamps.staffEntry': -1 });
      
      return res.json(pendingItems);
    }
    
    // SCENARIO B: STAFF LOGGED IN (Optional)
    // Show items they submitted that are still pending
    if (req.user.role === 'staff') {
       const myPending = await Inventory.find({
         status: 'pending-client',
         staffId: req.user.id
       }).sort({ 'timestamps.staffEntry': -1 });
       return res.json(myPending);
    }

    res.json([]);
  } catch (err) {
    console.error('Error fetching pending:', err);
    res.status(500).send('Server Error');
  }
});

// 3. SUBMIT INVENTORY (Used by Staff Dashboard)
// Matches axios.post('/api/inventory', formData)
router.post('/', auth, async (req, res) => {
  try {
    // Correctly destructure what the Frontend ACTUALLY sends
    const { 
      binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode 
    } = req.body;

    console.log('Submitting Inventory:', binId, uniqueCode);

    // Calculate Discrepancy
    const discrepancy = Math.abs(bookQuantity - actualQuantity);

    // Determine Status
    // If perfect match, auto-approve. If mismatch, send to client.
    let status = 'auto-approved';
    if (discrepancy > 0) status = 'pending-client';

    // Find the client Object ID based on uniqueCode (to link relationships)
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

// 4. RESPOND TO ENTRY (Used by Client Dashboard)
// Matches axios.post('/api/inventory/:id/respond')
router.post('/:id/respond', auth, async (req, res) => {
  try {
    const { action, comment } = req.body; // action: 'approved' | 'rejected'
    const entryId = req.params.id;

    const entry = await Inventory.findById(entryId);
    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    // Security Check: Verify this entry belongs to the requesting client
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

    // Update Response Details
    entry.clientResponse = {
        action,
        comment
    };
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
