const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

// Serialize user for the session
passport.serializeUser((user, done) => {
  console.log('Serializing user:', {
    id: user._id,
    email: user.email,
    name: user.name
  });
  done(null, user._id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user ID:', id);
    const user = await User.findById(id);
    if (!user) {
      console.log('User not found during deserialization');
      return done(null, false);
    }
    console.log('User deserialized successfully:', {
      id: user._id,
      email: user.email,
      name: user.name
    });
    done(null, user);
  } catch (error) {
    console.error('Error deserializing user:', error);
    done(error);
  }
});

// Google OAuth Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'https://crm-backend-y93k.onrender.com/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    console.log('Google OAuth callback received for profile:', {
      id: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName
    });

    // Find or create user
    let user = await User.findOne({ googleId: profile.id });
    
    if (!user) {
      console.log('Creating new user for Google profile:', profile.id);
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        lastLogin: new Date()
      });
    } else {
      console.log('Updating existing user login time:', user._id);
      user.lastLogin = new Date();
      await user.save();
    }

    console.log('Authentication successful for user:', {
      id: user._id,
      email: user.email,
      name: user.name
    });

    return done(null, user);
  } catch (error) {
    console.error('Error in Google OAuth strategy:', error);
    return done(error);
  }
}));

module.exports = passport; 