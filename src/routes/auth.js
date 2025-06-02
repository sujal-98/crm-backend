const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session'); // You'll need to create this model
const config = require('../config/config');

// Configure session cookie settings
const getSessionCookieSettings = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  domain: process.env.NODE_ENV === 'production' ? '.onrender.com' : undefined,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  path: '/'
});

// Google OAuth login route
router.get('/google',
  (req, res, next) => {
    // Store the original session ID if it exists
    const originalSessionID = req.sessionID;
    
    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account', // Force Google to show account selection
      state: originalSessionID // Pass the original session ID as state
    })(req, res, next);
  }
);

// Google OAuth callback route
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/google/failure',
    session: true,
    keepSessionInfo: true
  }),
  (req, res) => {
    if (!req.user) {
      return res.redirect('/api/auth/google/failure');
    }

    // Set cookie options based on environment
    const cookieOptions = {
      httpOnly: true,
      secure: true, // Always use secure cookies
      sameSite: 'none', // Required for cross-origin
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      domain: '.onrender.com'
    };

    // Set the session cookie
    res.cookie('xeno.sid', req.sessionID, cookieOptions);

    // Save the session explicitly with error handling
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }

      // Log successful authentication
      console.log('Authentication successful, session saved:', {
        sessionID: req.sessionID,
        user: {
          id: req.user._id,
          email: req.user.email,
          name: req.user.name
        },
        cookie: req.session.cookie
      });

      // Redirect to frontend callback URL
      const redirectUrl = config.google.redirectUrl;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    });
  }
);

// Google OAuth failure route
router.get('/google/failure', (req, res) => {
  res.status(401).json({
    message: 'Google authentication failed'
  });
});

// Get current user
router.get('/me', async (req, res) => {
  console.log('GET /me request received');
  console.log('Session Debug:', {
    sessionID: req.sessionID,
    session: req.session,
    isAuthenticated: req.isAuthenticated(),
    user: req.user,
    cookies: req.cookies
  });

  try {
    // If already authenticated, return user data
    if (req.isAuthenticated() && req.user) {
      return res.json({
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        googleId: req.user.googleId,
        role: req.user.role
      });
    }

    // If session exists but not authenticated, try to restore
    if (req.session?.passport?.user) {
      const user = await User.findById(req.session.passport.user);
      if (user) {
        await new Promise((resolve, reject) => {
          req.login(user, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        return res.json({
          id: user._id,
          email: user.email,
          name: user.name,
          googleId: user.googleId,
          role: user.role
        });
      }
    }

    // If no valid session
    res.status(401).json({ 
      status: 'error',
      message: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    });
  } catch (error) {
    console.error('Error in /me route:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
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