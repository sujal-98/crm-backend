require('dotenv').config();
const mongoose = require('mongoose');
const messageBroker = require('../services/messageBroker');
const Customer = require('../models/Customer');

const CUSTOMER_GROUP = 'customer-processors';
const CONSUMER_NAME = `customer-processor-${process.pid}`;

async function handleCustomerEvent(event) {
  const { type, data } = event;

  switch (type) {
    case 'customer.created':
      await Customer.create(data);
      break;

    case 'customer.updated':
      await Customer.findByIdAndUpdate(data._id, data, { new: true });
      break;

    case 'customer.deleted':
      await Customer.findByIdAndDelete(data._id);
      break;

    default:
      console.warn(`Unknown event type: ${type}`);
  }
}

async function startConsumer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to MongoDB');

    // Start consuming messages
    console.log(`Starting customer consumer: ${CONSUMER_NAME}`);
    await messageBroker.subscribe(
      messageBroker.streams.customers,
      CUSTOMER_GROUP,
      CONSUMER_NAME,
      handleCustomerEvent
    );
  } catch (error) {
    console.error('Error in customer consumer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down customer consumer...');
  await messageBroker.close();
  await mongoose.connection.close();
  process.exit(0);
});

startConsumer(); 