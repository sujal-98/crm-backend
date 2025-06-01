const mongoose = require('mongoose');

const communicationLogSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  messageId: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SENT', 'FAILED', 'DELIVERED'],
    default: 'PENDING'
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  vendorResponse: {
    type: Object
  },
  sentAt: Date,
  deliveredAt: Date
}, {
  timestamps: true
});

// Index for batch processing
communicationLogSchema.index({ status: 1, updatedAt: 1 });
// Index for campaign tracking
communicationLogSchema.index({ campaignId: 1, status: 1 });
// Index for customer tracking
communicationLogSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('CommunicationLog', communicationLogSchema); 