// Comment out Redis for deployment
// const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class MessageBroker {
  constructor() {
    // Comment out Redis initialization
    // this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.streams = {
      customers: 'customer-events',
      orders: 'order-events'
    };
  }

  async publish(stream, event) {
    // Mock implementation for deployment
    console.log(`[MOCK] Publishing to ${stream}:`, event);
    return uuidv4();
  }

  async subscribe(stream, consumerGroup, consumerName, handler) {
    // Mock implementation for deployment
    console.log(`[MOCK] Subscribing to ${stream} as ${consumerName}`);
    return;
  }

  async close() {
    // Mock implementation for deployment
    console.log('[MOCK] Closing message broker');
  }
}

// Create singleton instance
const messageBroker = new MessageBroker();

module.exports = messageBroker; 