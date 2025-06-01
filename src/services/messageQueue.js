const Redis = require('ioredis');
const CommunicationLog = require('../models/CommunicationLog');
const Campaign = require('../models/Campaign');

class MessageQueue {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
    this.queueName = 'delivery-receipts';
    this.batchSize = 100;
    this.processInterval = 5000; // Process every 5 seconds
    
    // Start processing
    this.startProcessing();
  }

  async addToQueue(deliveryReceipt) {
    await this.redis.lpush(this.queueName, JSON.stringify(deliveryReceipt));
  }

  async startProcessing() {
    setInterval(async () => {
      try {
        await this.processBatch();
      } catch (error) {
        console.error('Error processing message batch:', error);
      }
    }, this.processInterval);
  }

  async processBatch() {
    const batch = [];
    
    // Get batch of messages from Redis
    for (let i = 0; i < this.batchSize; i++) {
      const message = await this.redis.rpop(this.queueName);
      if (!message) break;
      batch.push(JSON.parse(message));
    }

    if (batch.length === 0) return;

    // Group messages by campaign for efficient updates
    const campaignUpdates = {};
    const bulkOps = [];

    for (const receipt of batch) {
      // Prepare communication log update
      bulkOps.push({
        updateOne: {
          filter: { messageId: receipt.messageId },
          update: {
            $set: {
              status: receipt.status,
              deliveredAt: receipt.status === 'SENT' ? new Date(receipt.timestamp) : null,
              failureReason: receipt.status === 'FAILED' ? receipt.error : null,
              'metadata.deliveryAttempt': receipt.metadata.deliveryAttempt
            }
          }
        }
      });

      // Group campaign stats
      const log = await CommunicationLog.findOne({ messageId: receipt.messageId });
      if (log) {
        const campaignId = log.campaignId.toString();
        if (!campaignUpdates[campaignId]) {
          campaignUpdates[campaignId] = { sent: 0, failed: 0 };
        }
        if (receipt.status === 'SENT') {
          campaignUpdates[campaignId].sent++;
        } else if (receipt.status === 'FAILED') {
          campaignUpdates[campaignId].failed++;
        }
      }
    }

    // Execute bulk operations
    if (bulkOps.length > 0) {
      await CommunicationLog.bulkWrite(bulkOps);
    }

    // Update campaign stats
    for (const [campaignId, stats] of Object.entries(campaignUpdates)) {
      await Campaign.updateOne(
        { _id: campaignId },
        {
          $inc: {
            'stats.sent': stats.sent,
            'stats.failed': stats.failed
          }
        }
      );
    }
  }
}

module.exports = new MessageQueue(); 