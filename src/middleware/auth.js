const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to verify JWT token
 */
const verifyToken = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

/**
 * Authentication middleware using Passport Google OAuth
 */
const auth = passport.authenticate('google', {
  session: false,
  failureRedirect: '/api/auth/google/failure'
});

/**
 * Middleware to check if user is authenticated
 */
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Not authenticated' });
};

/**
 * Middleware to check if user has required role
 */
const hasRole = (role) => {
  return (req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

module.exports = {
  auth,
  verifyToken,
  isAuthenticated,
  hasRole
}; 