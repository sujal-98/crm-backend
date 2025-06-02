const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  _id: String,
  expires: {
    type: Date,
    index: { expires: '1d' } // Automatically remove expired sessions after 1 day
  },
  session: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '1d' // Ensure document is removed after 1 day
  },
  lastAccessed: {
    type: Date,
    default: Date.now
  },
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  }
}, {
  timestamps: true,
  strict: false, // Allow flexible session data
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
sessionSchema.index({ 'session.user.id': 1 });
sessionSchema.index({ expires: 1 });
sessionSchema.index({ createdAt: 1 });

// Virtual to check if session is expired
sessionSchema.virtual('isExpired').get(function() {
  return this.expires && this.expires < new Date();
});

// Pre-save hook to update last accessed time
sessionSchema.pre('save', function(next) {
  this.lastAccessed = new Date();
  next();
});

// Method to safely update session data
sessionSchema.methods.updateSessionData = function(data) {
  this.session = {
    ...this.session,
    ...data
  };
  return this.save();
};

// Static method to find and clean up expired sessions
sessionSchema.statics.cleanupExpiredSessions = async function() {
  const now = new Date();
  try {
    const result = await this.deleteMany({ expires: { $lt: now } });
    console.log(`Cleaned up ${result.deletedCount} expired sessions`);
    return result;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    throw error;
  }
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session; 