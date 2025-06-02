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
    res.redirect(process.env.FRONTEND_URL || 'https://crm-application-ictu.onrender.com');
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
    // Get the session ID before destroying it
    const sessionId = req.sessionID;

    // Destroy the session in MongoDB
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destroy error:', err);
            reject(err);
          }
          resolve();
        });
      });
    }

    // Clear all session cookies with proper domain and path
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    };

    // Clear the session cookie
    res.clearCookie('xeno.sid', cookieOptions);
    res.clearCookie('connect.sid', cookieOptions);
    res.clearCookie('session', cookieOptions);

    // If using MongoDB store, explicitly remove the session
    if (req.sessionStore && typeof req.sessionStore.destroy === 'function') {
      await new Promise((resolve) => {
        req.sessionStore.destroy(sessionId, (err) => {
          if (err) console.error('Session store destroy error:', err);
          resolve();
        });
      });
    }

    // Log the user out of Passport
    req.logout((err) => {
      if (err) console.error('Passport logout error:', err);
    });

    // Clear any user data from the request
    req.user = null;
    req.session = null;

    res.status(200).json({ 
      status: 'success',
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Even if there's an error, try to clear cookies
    res.clearCookie('xeno.sid');
    res.clearCookie('connect.sid');
    res.clearCookie('session');
    
    res.status(500).json({ 
      status: 'error',
      message: 'Error logging out',
      error: error.message 
    });
  }
});

module.exports = router; 