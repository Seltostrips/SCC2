const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Inventory = require('../models/Inventory');
const ReferenceInventory = require('../models/ReferenceInventory');
const auth = require('../middleware/auth');

// 1. GET ALL USERS
router.get('/users', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 2. GET INVENTORY (OPTIMIZED + DATE FILTER)
router.get('/inventory-all', auth, async (req, res) => {
  try {
    const { limit, startDate, endDate } = req.query; 

    const pipeline = [];

    // 1. DATE FILTER (Apply first for performance)
    if (startDate || endDate) {
        const dateQuery = {};
        if (startDate) {
            dateQuery.$gte = new Date(startDate); // Start of day (00:00:00)
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // End of day (23:59:59)
            dateQuery.$lte = end;
        }
        pipeline.push({ $match: { 'timestamps.staffEntry': dateQuery } });
    }

    // 2. Sort (Newest first)
    pipeline.push({ $sort: { 'timestamps.staffEntry': -1 } });

    // 3. Limit (Optional, used for Monitor View)
    if (limit) {
        pipeline.push({ $limit: parseInt(limit) });
    }

    // 4. Lookups (Expensive joins)
    pipeline.push(
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
      }
    );

    const entries = await Inventory.aggregate(pipeline);

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
        
        // Detailed ODIN Data
        odinMin: entry.odin?.minQuantity || 0,
        odinBlocked: entry.odin?.blocked || 0,
        odinMax: entry.odin?.maxQuantity || 0,
        
        // Detailed Counts Data
        countPicking: entry.counts?.picking || 0,
        countBulk: entry.counts?.bulk || 0,
        countNearExpiry: entry.counts?.nearExpiry || 0,
        countJit: entry.counts?.jit || 0,
        countDamaged: entry.counts?.damaged || 0,
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
    console.error('Admin Inventory Error:', err);
    res.status(500).send('Server Error');
  }
});

// 3. BULK UPLOAD INVENTORY
router.post('/upload-inventory', auth, async (req, res) => {
  try {
    const items = req.body;
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

// 4. BULK ASSIGN STAFF
router.post('/assign-staff', auth, async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).send('Expected array');

    const operations = users.map(u => ({
      updateOne: {
        filter: { uniqueCode: u.uniqueCode },
        update: { 
          $set: { 
            name: u.name, 
            loginPin: u.loginPin, 
            role: 'staff',
            locations: u.locations,
            mappedLocation: u.mappedLocation
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

// 5. BULK ASSIGN CLIENT
router.post('/assign-client', auth, async (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) return res.status(400).send('Expected array');

    const operations = users.map(u => ({
      updateOne: {
        filter: { uniqueCode: u.uniqueCode },
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

// 6. DELETE ALL STAFF
router.delete('/delete-all-staff', auth, async (req, res) => {
  try {
    const result = await User.deleteMany({ role: 'staff' });
    res.json({ message: `Deleted ${result.deletedCount} staff members.` });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 7. DELETE ALL CLIENTS
router.delete('/delete-all-clients', auth, async (req, res) => {
  try {
    const result = await User.deleteMany({ role: 'client' });
    res.json({ message: `Deleted ${result.deletedCount} clients.` });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 8. DELETE ALL REFERENCE INVENTORY
router.delete('/delete-all-reference-inventory', auth, async (req, res) => {
  try {
    const result = await ReferenceInventory.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} inventory items.` });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
