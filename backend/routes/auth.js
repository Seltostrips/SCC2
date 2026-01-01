const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Middleware to check MongoDB connection
const checkDBConnection = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database connection not established.' });
  }
  next();
};

// @route   POST api/auth/register
// @desc    Register a user (Primarily for Admins now)
router.post('/register', checkDBConnection, async (req, res) => {
  const { name, email, password, role } = req.body;
  
  try {
    // 1. Check if Admin already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    
    // 2. Create user object
    user = new User({
      name,
      email,
      password, // Will be hashed below
      role: role || 'admin', // Default to admin if registering via this route
      isApproved: true // Auto-approve admins
    });
    
    // 3. Hash password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    await user.save();
    
    // 4. Return Token immediately
    const payload = { id: user.id, role: user.role };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      res.status(201).json({ 
        token, 
        user: { id: user.id, name: user.name, email: user.email, role: user.role } 
      });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
router.post('/login', checkDBConnection, async (req, res) => {
  const { sccId, pin, email, password } = req.body;
  
  try {
    let user;

    // --- SCENARIO 1: ADMIN LOGIN (Email + Password) ---
    if (email) {
       user = await User.findOne({ email });
       if (!user) return res.status(400).json({ message: 'Invalid credentials' });
       
       // Verify Password
       const isMatch = await bcrypt.compare(password, user.password);
       if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    } 
    
    // --- SCENARIO 2: STAFF/CLIENT LOGIN (SCC ID + PIN) ---
    else if (sccId) {
      user = await User.findOne({ sccId });
      if (!user) return res.status(400).json({ message: 'Invalid SCC ID' });
      
      // Verify PIN (Simple string comparison for CSV loaded pins)
      // Note: Ensure your CSV upload saves pins as strings in the DB
      if (user.pin !== pin.toString()) {
        return res.status(400).json({ message: 'Invalid PIN' });
      }
    } else {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    // Check Approval (Optional, defaulting to true for now)
    if (!user.isApproved) {
      return res.status(401).json({ message: 'Account pending approval' });
    }

    // Create Token
    const payload = { id: user.id, role: user.role };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          role: user.role,
          assignedLocations: user.assignedLocations, // For Staff
          mappedLocation: user.mappedLocation        // For Client
        }
      });
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/auth/me
// @desc    Get current user data
router.get('/me', [auth, checkDBConnection], async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
