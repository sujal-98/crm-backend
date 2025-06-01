const Redis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

class MessageBroker {
  constructor() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.streams = {
      customers: 'customer-events',
      orders: 'order-events'
    };
  }

  async publish(stream, event) {
    const eventId = uuidv4();
    const eventData = {
      id: eventId,
      type: event.type,
      data: JSON.stringify(event.data),
      timestamp: Date.now()
    };

    try {
      await this.redis.xadd(stream, '*', ...Object.entries(eventData).flat());
      return eventId;
    } catch (error) {
      console.error(`Error publishing to ${stream}:`, error);
      throw error;
    }
  }

  async subscribe(stream, consumerGroup, consumerName, handler) {
    try {
      // Create consumer group if it doesn't exist
      try {
        await this.redis.xgroup('CREATE', stream, consumerGroup, '0', 'MKSTREAM');
      } catch (error) {
        if (!error.message.includes('BUSYGROUP')) {
          throw error;
        }
      }

      // Start consuming messages
      while (true) {
        try {
          const messages = await this.redis.xreadgroup(
            'GROUP', consumerGroup, consumerName,
            'COUNT', 1, 'BLOCK', 2000,
            'STREAMS', stream, '>'
          );

          if (messages) {
            for (const [stream, streamMessages] of messages) {
              for (const [messageId, fields] of streamMessages) {
                const event = this.parseMessage(fields);
                try {
                  await handler(event);
                  // Acknowledge the message
                  await this.redis.xack(stream, consumerGroup, messageId);
                } catch (error) {
                  console.error(`Error processing message ${messageId}:`, error);
                  // You might want to implement retry logic or dead letter queue here
                }
              }
            }
          }
        } catch (error) {
          if (error.message !== 'Connection is closed.') {
            console.error('Error in consumer loop:', error);
          }
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error(`Error in subscribe for ${stream}:`, error);
      throw error;
    }
  }

  parseMessage(fields) {
    const event = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      let value = fields[i + 1];
      if (key === 'data') {
        value = JSON.parse(value);
      }
      event[key] = value;
    }
    return event;
  }

  async close() {
    await this.redis.quit();
  }
}

// Create singleton instance
const messageBroker = new MessageBroker();

module.exports = messageBroker; 