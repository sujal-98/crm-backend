const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  segmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment',
    required: true
  },
  messageTemplate: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['DRAFT', 'RUNNING', 'COMPLETED', 'FAILED'],
    default: 'DRAFT'
  },
  audienceSize: {
    type: Number,
    required: true
  },
  startedAt: Date,
  completedAt: Date,
  stats: {
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    final: {
      sent: { type: Number },
      failed: { type: Number },
      total: { type: Number },
      successRate: { type: String }
    }
  },
  createdBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Campaign', campaignSchema); 