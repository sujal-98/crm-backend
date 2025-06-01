require('dotenv').config();
const mongoose = require('mongoose');
const messageBroker = require('../services/messageBroker');
const Order = require('../models/orders');
const Customer = require('../models/Customer');

const ORDER_GROUP = 'order-processors';
const CONSUMER_NAME = `order-processor-${process.pid}`;

async function handleOrderEvent(event) {
  const { type, data } = event;

  switch (type) {
    case 'order.created':
      const order = await Order.create(data);
      // Update customer's order history
      await Customer.findByIdAndUpdate(data.customer, {
        $push: { orders: order._id }
      });
      break;

    case 'order.updated':
      await Order.findByIdAndUpdate(data._id, data, { new: true });
      break;

    case 'order.deleted':
      const orderToDelete = await Order.findById(data._id);
      if (orderToDelete) {
        // Remove order from customer's order history
        await Customer.findByIdAndUpdate(orderToDelete.customer, {
          $pull: { orders: orderToDelete._id }
        });
        await Order.findByIdAndDelete(data._id);
      }
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
    console.log(`Starting order consumer: ${CONSUMER_NAME}`);
    await messageBroker.subscribe(
      messageBroker.streams.orders,
      ORDER_GROUP,
      CONSUMER_NAME,
      handleOrderEvent
    );
  } catch (error) {
    console.error('Error in order consumer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down order consumer...');
  await messageBroker.close();
  await mongoose.connection.close();
  process.exit(0);
});

startConsumer(); 