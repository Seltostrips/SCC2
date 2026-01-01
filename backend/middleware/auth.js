const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // 1. FIX: Use the same fallback 'secret' as the login route
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    
    // 2. FIX: Check both nested (.user.id) and flat (.id) structures to be safe
    const userId = decoded.user ? decoded.user.id : decoded.id;
    
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      throw new Error('User not found');
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error.message);
    res.status(401).json({ message: 'Token is not valid' });
  }
};
