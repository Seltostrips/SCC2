const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory');
const auth = require('../middleware/auth');

// 1. GET ALL USERS (Restored)
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 2. GET ALL INVENTORY (New Smart Aggregation for Report)
router.get('/inventory-all', auth, async (req, res) => {
  try {
    const entries = await Inventory.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'staffId',
          foreignField: '_id',
          as: 'staffDetails'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedClientId',
          foreignField: '_id',
          as: 'clientDetails'
        }
      },
      {
        $lookup: {
          from: 'referenceinventories',
          localField: 'skuId',
          foreignField: 'skuId',
          as: 'refDetails'
        }
      },
      { $sort: { 'timestamps.staffEntry': -1 } }
    ]);

    // Format for Frontend
    const formatted = entries.map(entry => {
      const staff = entry.staffDetails[0] || {};
      const client = entry.clientDetails[0] || {};
      const ref = entry.refDetails[0] || {};

      return {
        _id: entry._id,
        skuId: entry.skuId,
        skuName: entry.skuName,
        pickingLocation: ref.pickingLocation || entry.location || '-',
        bulkLocation: ref.bulkLocation || '-',
        submittedLocation: entry.location,
        odinMin: entry.odin?.minQuantity || 0,
        odinMax: entry.odin?.maxQuantity || 0,
        physicalCount: entry.counts?.totalIdentified || 0,
        staffName: staff.name || 'Unknown',
        clientName: client.name || '-',
        status: entry.status,
        auditResult: entry.auditResult,
        clientComment: entry.clientResponse?.comment || '-',
        dateSubmitted: entry.timestamps?.staffEntry
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 3. BULK UPLOAD INVENTORY (Restored BulkWrite)
router.post('/upload-inventory', auth, async (req, res) => {
  try {
    const items = req.body; // Expects Array
    if (!Array.isArray(items)) return res.status(400).send('Expected array of items');

    const operations = items.map(item => ({
      updateOne: { 
        filter: { skuId: item.skuId }, 
        update: { $set: item }, 
        upsert: true 
      }
    }));
    
    await ReferenceInventory.bulkWrite(operations);
    res.json({ message: `Updated ${items.length} inventory items` });
  } catch (err) {
    console.error('Inventory Upload Error:', err);
    res.status(500).send('Server Error');
  }
});

// 4. BULK ASSIGN STAFF (Restored & Adapted to New Schema)
router.post('/assign-staff', auth, async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).send('Expected array');

    const operations = users.map(u => ({
      updateOne: {
        filter: { uniqueCode: u.uniqueCode }, // Match by Staff ID
        update: { 
          $set: { 
            name: u.name, 
            loginPin: u.loginPin, 
            role: 'staff',
            locations: u.locations, // Array of strings
            mappedLocation: u.mappedLocation // String backup
          } 
        },
        upsert: true
      }
    }));
    
    const result = await User.bulkWrite(operations);
    res.json({ message: 'Staff Updated', result });
  } catch (err) {
    console.error('Staff Upload Error:', err);
    res.status(500).send('Server Error');
  }
});

// 5. BULK ASSIGN CLIENT (Restored & Adapted to New Schema)
router.post('/assign-client', auth, async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).send('Expected array');

    const operations = users.map(u => ({
      updateOne: {
        filter: { uniqueCode: u.uniqueCode }, // Match by Client ID
        update: { 
          $set: { 
            name: u.name, 
            loginPin: u.loginPin, 
            role: 'client', 
            locations: u.locations,
            mappedLocation: u.mappedLocation
          } 
        },
        upsert: true
      }
    }));
    
    const result = await User.bulkWrite(operations);
    res.json({ message: 'Clients Updated', result });
  } catch (err) {
    console.error('Client Upload Error:', err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
