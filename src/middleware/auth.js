const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User');


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
  isAuthenticated,
  hasRole
}; 