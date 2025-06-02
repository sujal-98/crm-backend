const mongoose = require('mongoose');
const Session = require('../models/Session');

// MongoDB connection options
const mongoOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ssl: true,
  sslValidate: true,
  retryWrites: true,
  w: 'majority',
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000
};

async function cleanupSessions() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, mongoOptions);
    console.log('Connected to MongoDB for session cleanup');

    // Perform session cleanup
    const result = await Session.cleanupExpiredSessions();

    // Additional session management
    const now = new Date();
    const oldSessionThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24 hours

    // Remove very old sessions
    const oldSessionsResult = await Session.deleteMany({
      createdAt: { $lt: oldSessionThreshold }
    });

    console.log('Session Cleanup Report:', {
      expiredSessionsRemoved: result.deletedCount,
      oldSessionsRemoved: oldSessionsResult.deletedCount,
      timestamp: now.toISOString()
    });
  } catch (error) {
    console.error('Session Cleanup Error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
  }
}

// Run cleanup immediately
cleanupSessions().catch(console.error);

module.exports = cleanupSessions; 