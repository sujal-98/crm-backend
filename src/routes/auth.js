const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session'); // You'll need to create this model

// Google OAuth login route
router.get('/google',
  (req, res, next) => {
    // Clear any existing session
    if (req.session) {
      req.session.destroy();
    }
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account' // Force Google to show account selection
    })(req, res, next);
  }
);

// Google OAuth callback route
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: true
  }),
  (req, res) => {
    // Set session creation time
    req.session.createdAt = Date.now();
    
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

// Check session status
router.get('/session', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    });
  }

  const sessionAge = Date.now() - (req.session.createdAt || req.session.cookie.expires);
  const sessionExpiresIn = 2 * 60 * 60 * 1000 - sessionAge; // Time remaining in milliseconds

  res.json({
    status: 'success',
    data: {
      isAuthenticated: true,
      user: req.user,
      sessionExpiresIn,
      sessionExpiresAt: new Date(Date.now() + sessionExpiresIn)
    }
  });
});

// Logout endpoint
router.post('/logout', async (req, res) => {
  try {
    if (req.session) {
      // Destroy the session
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }
    
    // Clear the session cookie
    res.clearCookie('connect.sid', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    // Clear any other auth cookies if they exist
    res.clearCookie('session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });

    res.status(200).json({ 
      status: 'success',
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Error logging out',
      error: error.message 
    });
  }
});

module.exports = router; 