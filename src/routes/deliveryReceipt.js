const express = require('express');
const router = express.Router();
const CommunicationLog = require('../models/CommunicationLog');

// Queue for batch processing
let receiptQueue = [];
const BATCH_SIZE = 100;
const BATCH_TIMEOUT = 5000; // 5 seconds

// Process queue in batches
async function processReceiptQueue() {
  if (receiptQueue.length === 0) return;

  const batch = receiptQueue.splice(0, BATCH_SIZE);
  
  try {
    const bulkOps = batch.map(receipt => ({
      updateOne: {
        filter: { messageId: receipt.messageId },
        update: {
          $set: {
            status: receipt.status,
            deliveredAt: receipt.timestamp,
            'vendorResponse.deliveryStatus': receipt
          }
        }
      }
    }));

    await CommunicationLog.bulkWrite(bulkOps);
    console.log(`Processed ${batch.length} delivery receipts`);
  } catch (error) {
    console.error('Error processing delivery receipts:', error);
    // Re-queue failed items
    receiptQueue.push(...batch);
  }
}

// Start periodic processing
setInterval(processReceiptQueue, BATCH_TIMEOUT);

// Delivery Receipt endpoint
router.post('/', async (req, res) => {
  try {
    const receipt = req.body;
    
    // Validate receipt
    if (!receipt.messageId || !receipt.status) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid delivery receipt'
      });
    }

    // Add to processing queue
    receiptQueue.push(receipt);

    // Process immediately if queue reaches batch size
    if (receiptQueue.length >= BATCH_SIZE) {
      processReceiptQueue();
    }

    res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Delivery receipt error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router; 