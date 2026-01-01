const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// 1. REGISTER / BULK UPLOAD (Now with OVERRIDE/UPSERT capabilities)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, uniqueCode, loginPin, locations, mappedLocation } = req.body;

    // A. VALIDATE IDENTITY
    // We use uniqueCode (Staff ID) as the primary key for Staff/Clients
    // We use email as the primary key for Admin
    let query = {};
    if (role === 'admin') {
        if (!email) return res.status(400).json({ message: 'Admin requires email' });
        query = { email: email };
    } else {
        if (!uniqueCode) return res.status(400).json({ message: 'Staff/Client requires ID' });
        query = { uniqueCode: uniqueCode };
    }

    // B. FIND EXISTING USER
    let user = await User.findOne(query);

    // C. PREPARE DATA
    const userData = {
        name,
        role,
        locations: locations || [],
        mappedLocation: mappedLocation || (locations ? locations.join(', ') : ''),
        // Only update these if provided
        ...(uniqueCode && { uniqueCode }),
        ...(loginPin && { loginPin }),
        ...(email && { email }),
        ...(password && { password }) // Will be hashed by pre-save hook if modified
    };

    if (user) {
        // --- UPDATE EXISTING (Override) ---
        // We update fields. For Mongoose pre-save hook to work on password, 
        // we assign properties individually rather than using findOneAndUpdate
        user.name = userData.name;
        user.role = userData.role;
        user.locations = userData.locations;
        user.mappedLocation = userData.mappedLocation;
        if (loginPin) user.loginPin = loginPin;
        if (password) user.password = password;
        
        await user.save();
        return res.status(200).json({ message: 'User updated successfully', type: 'update' });
    } else {
        // --- CREATE NEW ---
        user = new User(userData);
        await user.save();
        return res.status(201).json({ message: 'User created successfully', type: 'create' });
    }

  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).send('Server error');
  }
});

// 2. EDIT USER (For Admin UI)
router.put('/users/:id', async (req, res) => {
    try {
        const { name, loginPin, locations } = req.body;
        
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Update Allowed Fields
        if (name) user.name = name;
        if (loginPin) user.loginPin = loginPin;
        if (locations) {
            user.locations = locations;
            user.mappedLocation = locations.join(', ');
        }

        await user.save();
        res.json(user);
    } catch (err) {
        console.error('Update Error:', err);
        res.status(500).send('Server Error');
    }
});

// 3. LOGIN ROUTE (Unchanged)
router.post('/login', async (req, res) => {
  try {
    const { email, password, uniqueCode, loginPin, role } = req.body;
    let user;

    if (role === 'admin') {
      user = await User.findOne({ email });
      if (!user) return res.status(400).json({ message: 'Invalid Credentials' });
      const isMatch = await user.matchPassword(password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid Credentials' });
    } else {
      user = await User.findOne({ uniqueCode });
      if (!user) return res.status(400).json({ message: 'Invalid User Code' });
      const isMatch = await user.matchPin(loginPin);
      if (!isMatch) return res.status(400).json({ message: 'Invalid PIN' });
    }

    const payload = {
      user: { id: user.id, role: user.role, name: user.name }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '12h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { role: user.role, name: user.name, locations: user.locations } });
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// 4. GET USERS & ME (Unchanged)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { res.status(500).send('Server Error'); }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if(!token) return res.status(401).json({ msg: 'No token' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.user.id).select('-password -loginPin');
    res.json(user);
  } catch (err) { res.status(500).send('Server Error'); }
});

module.exports = router;
