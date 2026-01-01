const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Keep for Admin
const User = require('../models/User');

// Login Route
router.post('/login', async (req, res) => {
  const { sccId, pin, email, password } = req.body;
  
  try {
    let user;

    // Admin Login (Email/Password)
    if (email) {
       user = await User.findOne({ email });
       if (!user) return res.status(400).json({ message: 'User not found' });
       const isMatch = await bcrypt.compare(password, user.password);
       if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });
    } 
    // Staff/Client Login (SCC ID + PIN)
    else if (sccId) {
      user = await User.findOne({ sccId });
      if (!user) return res.status(400).json({ message: 'Invalid SCC ID' });
      // Simple string comparison for PIN as per request (or hash it if preferred)
      if (user.pin !== pin.toString()) return res.status(400).json({ message: 'Invalid PIN' });
    } else {
      return res.status(400).json({ message: 'Missing credentials' });
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
          assignedLocations: user.assignedLocations,
          mappedLocation: user.mappedLocation
        }
      });
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

module.exports = router;
