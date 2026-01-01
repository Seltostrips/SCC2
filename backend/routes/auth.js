const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// REGISTER USER (Handles both Admin JSON and CSV Bulk Upload)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, uniqueCode, loginPin, locations, mappedLocation } = req.body;

    // Check existing
    let user = await User.findOne({ 
      $or: [
        { email: email || 'dummy@x.com' }, 
        { uniqueCode: uniqueCode || 'dummyCode' }
      ]
    });
    
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      role,
      uniqueCode,
      loginPin,
      locations: locations || [], // Ensure array
      mappedLocation
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

// LOGIN ROUTE (Unified for Admin & Staff)
router.post('/login', async (req, res) => {
  try {
    const { email, password, uniqueCode, loginPin, role } = req.body;
    let user;

    // 1. ADMIN LOGIN (Email + Password)
    if (role === 'admin') {
      user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid Credentials' });
      
      const isMatch = await user.matchPassword(password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });
    } 
    
    // 2. STAFF/CLIENT LOGIN (Unique Code + PIN)
    else {
      user = await User.findOne({ uniqueCode });
      if (!user) return res.status(400).json({ message: 'Invalid User Code' });
      
      const isMatch = await user.matchPin(loginPin);
      if (!isMatch) return res.status(400).json({ message: 'Invalid PIN' });
    }

    // Generate Token
    const payload = {
      user: {
        id: user.id,
        role: user.role,
        name: user.name
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '12h' },
      (err, token) => {
        if (err) throw err;
        // Send locations to frontend to avoid extra calls
        res.json({ token, user: { role: user.role, name: user.name, locations: user.locations } });
      }
    );

  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// GET USERS (For Admin Dashboard)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

// GET CURRENT USER
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if(!token) return res.status(401).json({ msg: 'No token' });
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.user.id).select('-password -loginPin');
    
    res.json(user);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
