const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const Session = require('../models/Session'); // You'll need to create this model

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
    keepSessionInfo: true // Keep session information across login
  }),
  (req, res) => {
    // Ensure user is authenticated
    if (!req.user) {
      return res.redirect('/api/auth/google/failure');
    }

    // Set session creation time
    req.session.createdAt = Date.now();
    
    // Set cookie options
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
      domain: 'crm-application-ictu.onrender.com'
    };

    // Set session cookie with proper options
    res.cookie('xeno.sid', req.sessionID, cookieOptions);

    // Set additional user info in session
    req.session.user = {
      id: req.user._id.toString(),
      email: req.user.email,
      name: req.user.name,
      role: req.user.role
    };
    
    // Save the session explicitly
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }
      
      // Log session state
      console.log('Session saved successfully. State:', {
        id: req.sessionID,
        user: req.session.user,
        isAuthenticated: req.isAuthenticated(),
        cookie: req.session.cookie
      });
      
      // After successful authentication, redirect to frontend
      const frontendUrl = process.env.FRONTEND_URL || 'https://crm-application-ictu.onrender.com';
      res.redirect(`${frontendUrl}?sessionId=${req.sessionID}`);
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
    // First check if the user is authenticated via session
    if (req.isAuthenticated() && req.user) {
      const userData = {
        id: req.user._id,
        email: req.user.email,
        name: req.user.name,
        googleId: req.user.googleId,
        role: req.user.role
      };

      // Ensure session is saved
      await new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          resolve();
        });
      });

      return res.json(userData);
    }

    // If not authenticated, check if we have a valid session
    if (req.session && req.session.passport && req.session.passport.user) {
      // Try to restore the session
      const User = require('../models/User');
      const user = await User.findById(req.session.passport.user);
      
      if (user) {
        // Manually set up authentication
        req.login(user, async (err) => {
          if (err) {
            console.error('Session restoration error:', err);
            return res.status(401).json({ 
              status: 'error',
              message: 'Authentication failed',
              code: 'AUTH_FAILED'
            });
          }

          const userData = {
            id: user._id,
            email: user.email,
            name: user.name,
            googleId: user.googleId,
            role: user.role
          };

          // Save the restored session
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) reject(err);
              resolve();
            });
          });

          return res.json(userData);
        });
        return;
      }
    }

    // If all checks fail, return unauthorized
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