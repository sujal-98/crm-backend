const mongoose = require('mongoose');
const Customer = require('./Customer');

const segmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  conditionString: {
    type: String,
    required: true
  },
  customerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  }],
  createdBy: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true
});

// Indexes
segmentSchema.index({ createdBy: 1 });
segmentSchema.index({ tags: 1 });

// Method to calculate audience size
segmentSchema.methods.calculateAudienceSize = async function() {
  const customers = await Customer.findBySegmentRules(this.rules);
  this.audienceSize = customers.length;
  return this.save();
};

// Method to get customers in segment
segmentSchema.methods.getCustomers = async function() {
  return Customer.findBySegmentRules(this.rules);
};

// Static method to find segments by tag
segmentSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag });
};

// Pre-save middleware to validate rules
segmentSchema.pre('save', function(next) {
  next();
});

// Post-save middleware to update audience size
segmentSchema.post('save', async function() {
  if (this.isModified('rules')) {
    await this.calculateAudienceSize();
  }
});

const Segment = mongoose.model('Segment', segmentSchema);

module.exports = Segment; 