const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Inventory = require('../models/Inventory');
const User = require('../models/User');
const notificationService = require('../services/notificationService');
const mongoose = require('mongoose');

// Middleware to check MongoDB connection
const checkDBConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database connection not established. Please try again later.' });
  }
  next();
};

// Create inventory entry
router.post('/', [auth, checkDBConnection], async (req, res) => {
  const { binId, bookQuantity, actualQuantity, notes, location, uniqueCode, pincode } = req.body;
  
  try {
    console.log('Creating inventory entry:', req.body);
    
    // Find client with matching uniqueCode and pincode
    const client = await User.findOne({ 
      role: 'client', 
      uniqueCode, 
      'location.pincode': pincode 
    });
    
    if (!client) {
      return res.status(400).json({ message: 'No client found with this unique code and pincode combination' });
    }
    
    const newEntry = new Inventory({
      binId,
      bookQuantity,
      actualQuantity,
      notes,
      location,
      uniqueCode,
      pincode,
      staffId: req.user.id,
      clientId: client._id
    });
    
    // Calculate discrepancy and set status
    const discrepancy = Math.abs(bookQuantity - actualQuantity);
    newEntry.discrepancy = discrepancy;
    
    if (discrepancy === 0) {
      newEntry.status = 'auto-approved';
      newEntry.timestamps.finalStatus = new Date();
    } else {
      newEntry.status = 'pending-client';
    }
    
    await newEntry.save();
    
    console.log('Entry created with status:', newEntry.status);
    
    // If status is pending-client, notify specific client
    if (newEntry.status === 'pending-client') {
      // Emit real-time notification via Socket.io
      const io = req.app.get('io');
      if (io) {
        console.log('Emitting new-pending-entry event to specific client');
        io.emit(`new-pending-entry-${client._id}`, newEntry);
      }
      
      // Send email/WhatsApp notification to specific client
      await notificationService.notifyClient(client, newEntry);
    }
    
    res.status(201).json(newEntry);
  } catch (err) {
    console.error('Error creating inventory entry:', err);
    res.status(500).send('Server error');
  }
});

// Get pending entries for specific client
router.get('/pending', [auth, checkDBConnection], async (req, res) => {
  try {
    if (req.user.role !== 'client' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    let query = { status: 'pending-client' };
    
    // If client, only show their entries
    if (req.user.role === 'client') {
      query.clientId = req.user._id;
    }
    
    const pendingEntries = await Inventory.find(query)
      .populate('staffId', 'name')
      .populate('clientId', 'name')
      .sort({ 'timestamps.staffEntry': -1 });
    
    res.json(pendingEntries);
  } catch (err) {
    console.error('Error fetching pending entries:', err);
    res.status(500).send('Server error');
  }
});

// Get unique codes for dropdown (staff only)
router.get('/unique-codes', [auth, checkDBConnection], async (req, res) => {
  try {
    if (req.user.role !== 'staff') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const clients = await User.find({ role: 'client', isApproved: true })
      .select('uniqueCode company location.pincode');
    
    res.json(clients);
  } catch (err) {
    console.error('Error fetching unique codes:', err);
    res.status(500).send('Server error');
  }
});

// Client response to inventory entry
router.post('/:id/respond', [auth, checkDBConnection], async (req, res) => {
  const { action, comment } = req.body;
  
  try {
    if (req.user.role !== 'client' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const entry = await Inventory.findById(req.params.id);
    
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Clients can only respond to their own entries
    if (req.user.role === 'client' && entry.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to respond to this entry' });
    }
    
    if (entry.status !== 'pending-client') {
      return res.status(400).json({ message: 'Entry is not pending client review' });
    }
    
    entry.clientId = req.user.id;
    entry.timestamps.clientResponse = new Date();
    entry.clientResponse = {
      action,
      comment: comment || ''
    };
    
    if (action === 'approved') {
      entry.status = 'client-approved';
      entry.timestamps.finalStatus = new Date();
    } else if (action === 'rejected') {
      entry.status = 'recount-required';
    }
    
    await entry.save();
    
    console.log('Entry updated with status:', entry.status);
    
    // Notify staff about the response
    if (action === 'rejected') {
      await notificationService.notifyStaff(entry, 'Recount required for inventory entry');
      
      // Emit real-time notification via Socket.io
      const io = req.app.get('io');
      if (io) {
        console.log('Emitting entry-updated event to staff');
        io.emit(`entry-updated-${entry.staffId}`, entry);
      }
    }
    
    res.json(entry);
  } catch (err) {
    console.error('Error responding to inventory entry:', err);
    res.status(500).send('Server error');
  }
});

// Get all entries (for admin)
router.get('/', [auth, checkDBConnection], async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { startDate, endDate, location, staff, uniqueCode, pincode } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query['timestamps.staffEntry'] = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (location) {
      query.location = location;
    }
    
    if (staff) {
      // Find staff by name
      const staffUser = await User.findOne({ name: { $regex: staff, $options: 'i' }, role: 'staff' });
      if (staffUser) {
        query.staffId = staffUser._id;
      }
    }
    
    if (uniqueCode) {
      query.uniqueCode = uniqueCode;
    }
    
    if (pincode) {
      query.pincode = pincode;
    }
    
    const entries = await Inventory.find(query)
      .populate('staffId', 'name')
      .populate('clientId', 'name')
      .sort({ 'timestamps.staffEntry': -1 });
    
    res.json(entries);
  } catch (err) {
    console.error('Error fetching entries:', err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
