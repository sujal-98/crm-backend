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

    // Store the callback URL in session if provided
    const callbackUrl = req.query.callback;
    if (callbackUrl) {
      req.session.oauthCallbackUrl = callbackUrl;
    }

    passport.authenticate('google', {
      scope: ['profile', 'email'],
      prompt: 'select_account', // Force Google to show account selection
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/auth/google/callback`
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
    
    // Get the stored callback URL or use default
    const callbackUrl = req.session.oauthCallbackUrl || 
      `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`;
    
    // Clear the stored callback URL
    delete req.session.oauthCallbackUrl;
    
    // After successful authentication, redirect to frontend callback
    res.redirect(callbackUrl);
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
    const userId = req.user?._id;
    const sessionId = req.sessionID;

    // Immediately clear the session cookie to prevent any further requests
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined,
      expires: new Date(0)
    };

    // Clear all possible cookies immediately
    const cookiesToClear = [
      'xeno.sid',
      'connect.sid',
      'session',
      'auth',
      'token',
      'google_oauth_state',
      'google_oauth_code',
      'google_oauth_token',
      'google_oauth_refresh_token'
    ];

    cookiesToClear.forEach(cookieName => {
      res.clearCookie(cookieName, cookieOptions);
      res.clearCookie(cookieName, { ...cookieOptions, domain: undefined });
    });

    // Set headers to prevent caching and force re-authentication
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Clear-Site-Data': '"cache", "cookies", "storage"'
    });

    // Send immediate response
    res.status(200).json({ 
      status: 'success',
      message: 'Logged out successfully',
      forceReAuth: true
    });

    // Then perform cleanup in the background
    (async () => {
      try {
        // Delete ALL sessions for this user from MongoDB
        if (userId) {
          await Session.deleteMany({ 'session.user': userId });
        }

        // Delete the current session
        if (req.sessionStore && typeof req.sessionStore.destroy === 'function') {
          await new Promise((resolve) => {
            req.sessionStore.destroy(sessionId, (err) => {
              if (err) console.error('Session store destroy error:', err);
              resolve();
            });
          });
        }

        // Delete the session document directly
        await Session.deleteOne({ _id: sessionId });

        // Destroy the session in memory
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

        // Log the user out of Passport
        req.logout((err) => {
          if (err) console.error('Passport logout error:', err);
        });

        // Clear request data
        req.user = null;
        req.session = null;
      } catch (error) {
        console.error('Background logout cleanup error:', error);
      }
    })();
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear cookies immediately
    const cookieOptions = {
      expires: new Date(0),
      path: '/',
      domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    };
    
    // Clear all possible cookies
    const cookiesToClear = [
      'xeno.sid',
      'connect.sid',
      'session',
      'auth',
      'token',
      'google_oauth_state',
      'google_oauth_code',
      'google_oauth_token',
      'google_oauth_refresh_token'
    ];

    cookiesToClear.forEach(cookieName => {
      res.clearCookie(cookieName, cookieOptions);
      res.clearCookie(cookieName, { ...cookieOptions, domain: undefined });
    });
    
    res.status(500).json({ 
      status: 'error',
      message: 'Error logging out',
      error: error.message,
      forceReAuth: true
    });
  }
});

module.exports = router; 