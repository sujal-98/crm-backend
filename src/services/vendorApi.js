const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

class VendorApi {
  constructor() {
    this.deliveryReceiptUrl = 'http://localhost:4000/api/delivery-receipt';
  }

  async sendMessage(message, customerId) {
    const messageId = uuidv4();
    
    // Simulate API processing time (100-500ms)
    await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100));

    // Simulate 90% success rate
    const isSuccess = Math.random() < 0.9;

    if (!isSuccess) {
      throw new Error('Message delivery failed');
    }

    // Simulate async delivery receipt callback after 1-3 seconds
    setTimeout(async () => {
      try {
        await axios.post(this.deliveryReceiptUrl, {
          messageId,
          status: isSuccess ? 'SENT' : 'FAILED',
          timestamp: new Date().toISOString(),
          customerId,
          metadata: {
            deliveryAttempt: 1,
            vendor: 'dummy-vendor'
          }
        });
      } catch (error) {
        console.error('Failed to send delivery receipt:', error);
      }
    }, Math.random() * 2000 + 1000);

    return {
      messageId,
      status: 'ACCEPTED',
      timestamp: new Date().toISOString()
    };
  }

  // Method to simulate bulk message sending
  async sendBulkMessages(messages) {
    return Promise.all(
      messages.map(({ message, customerId }) => 
        this.sendMessage(message, customerId)
      )
    );
  }
}

module.exports = new VendorApi(); 