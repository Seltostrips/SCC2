const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ReferenceInventory = require('../models/ReferenceInventory');
const auth = require('../middleware/auth');

// Upload Inventory DB (Change 1)
router.post('/upload-inventory', auth, async (req, res) => {
  try {
    const items = req.body; // Expects JSON array
    // Bulk write for performance (update if exists, insert if new)
    const operations = items.map(item => ({
      updateOne: {
        filter: { skuId: item.skuId },
        update: { $set: item },
        upsert: true
      }
    }));
    await ReferenceInventory.bulkWrite(operations);
    res.json({ message: 'Inventory DB Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Upload Staff Assignments (Change 2)
router.post('/assign-staff', auth, async (req, res) => {
  try {
    const users = req.body;
    const operations = users.map(u => ({
      updateOne: {
        filter: { sccId: u.sccId },
        update: { 
          $set: { 
            name: u.name, 
            pin: u.pin, 
            role: 'staff',
            assignedLocations: u.assignedLocations 
          }
        },
        upsert: true
      }
    }));
    await User.bulkWrite(operations);
    res.json({ message: 'Staff Assignments Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Upload Client Assignments (Change 3)
router.post('/assign-client', auth, async (req, res) => {
  try {
    const users = req.body;
    const operations = users.map(u => ({
      updateOne: {
        filter: { sccId: u.sccId },
        update: { 
          $set: { 
            name: u.name, 
            pin: u.pin, 
            role: 'client',
            mappedLocation: u.mappedLocation 
          }
        },
        upsert: true
      }
    }));
    await User.bulkWrite(operations);
    res.json({ message: 'Client Assignments Updated' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
