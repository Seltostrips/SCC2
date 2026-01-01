const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory');
const auth = require('../middleware/auth');

// 1. GET ALL USERS (For User Management Tab)
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 2. GET ALL INVENTORY (For Audit Monitor Tab)
router.get('/inventory-all', auth, async (req, res) => {
  try {
    const items = await Inventory.find()
      .populate('staffId', 'name sccId')
      .populate('assignedClientId', 'name sccId')
      .sort({ 'timestamps.entry': -1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 3. EXISTING UPLOAD ROUTES
router.post('/upload-inventory', auth, async (req, res) => {
  try {
    const items = req.body;
    const operations = items.map(item => ({
      updateOne: { filter: { skuId: item.skuId }, update: { $set: item }, upsert: true }
    }));
    await ReferenceInventory.bulkWrite(operations);
    res.json({ message: 'Inventory DB Updated' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.post('/assign-staff', auth, async (req, res) => {
  try {
    const users = req.body;
    const operations = users.map(u => ({
      updateOne: {
        filter: { sccId: u.sccId },
        update: { $set: { name: u.name, pin: u.pin, role: 'staff', assignedLocations: u.assignedLocations } },
        upsert: true
      }
    }));
    await User.bulkWrite(operations);
    res.json({ message: 'Staff Assignments Updated' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

router.post('/assign-client', auth, async (req, res) => {
  try {
    const users = req.body;
    const operations = users.map(u => ({
      updateOne: {
        filter: { sccId: u.sccId },
        update: { $set: { name: u.name, pin: u.pin, role: 'client', mappedLocation: u.mappedLocation } },
        upsert: true
      }
    }));
    await User.bulkWrite(operations);
    res.json({ message: 'Client Assignments Updated' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
