const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session'); // You'll need to create this model

// Google OAuth login route
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// Google OAuth callback route
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: true
  }),
  (req, res) => {
    // After successful authentication, redirect to frontend
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`);
  }
);

// Google OAuth failure route
router.get('/google/failure', (req, res) => {
  res.status(401).json({
    message: 'Google authentication failed'
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  res.json(req.user);
});

// Logout endpoint
router.get('/logout', async (req, res) => {
  try {
    if (req.user) {
      const userId = req.user._id;

      // Remove the user from the User collection
      await User.findByIdAndDelete(userId);

      // Remove all sessions for this user
      await Session.deleteMany({
        'session.user': userId
      });

      // Destroy the current session
      if (req.session) {
        await new Promise((resolve, reject) => {
          req.session.destroy(err => {
            if (err) reject(err);
            resolve();
          });
        });
      }

      // Clear the cookie
      res.clearCookie('connect.sid', {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      });

      res.status(200).json({
        status: 'success',
        message: 'User logged out and account deleted successfully'
      });
    } else {
      res.status(401).json({
        status: 'error',
        message: 'No user session found'
      });
    }
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to logout and delete account',
      error: error.message
    });
  }
});

module.exports = router; 