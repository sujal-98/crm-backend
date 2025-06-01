const express = require('express');
const router = express.Router();
const Order = require('../models/orders');
const Customer = require('../models/Customer');
const { validateRequest } = require('../middleware/validation');
const { auth } = require('../middleware/auth');
// Comment out Redis and message broker for deployment
// const messageBroker = require('../services/messageBroker');
// const redis = require('../services/redis');

// Get all orders
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    
    // Search in order number or customer name
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const orders = await Order.find(query)
      .sort({ [sortBy]: sortOrder })
      .populate('customer', 'name email phone');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders', error: error.message });
  }
});

// Get order by ID
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone address');
    
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching order', error: error.message });
  }
});

// Create new order
router.post('/', async (req, res) => {
  // Comment out Redis guard for deployment
  // const key = `pending-email:${req.body.email.toLowerCase()}`;
  // const added = await redis.setnx(key, 1);  // 1 = inserted, 0 = already exists
  // if (!added) return res.status(400).json({message:'Email already queued'});
  // redis.expire(key, 300); // 5-min TTL

  try {
    // Verify customer exists
    const customer = await Customer.findById(req.body.customer);
    if (!customer) {
      return res.status(400).json({ message: 'Customer not found' });
    }

    // Generate order number
    const orderCount = await Order.countDocuments();
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${orderCount + 1}`;

    const orderData = {
      ...req.body,
      orderNumber,
      createdBy: req.user._id
    };

    // Comment out message broker for deployment
    // await messageBroker.publish(messageBroker.streams.orders, {
    //   type: 'order.created',
    //   data: orderData
    // });

    // Create order directly instead of using message broker
    const order = await Order.create(orderData);

    res.status(201).json({ 
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating order', error: error.message });
  }
});

// Update order
router.put('/:id', validateRequest({
  body: {
    status: { type: 'string', required: false },
    items: { type: 'array', required: false },
    totalAmount: { type: 'number', required: false },
    shippingAddress: { type: 'object', required: false },
    paymentMethod: { type: 'string', required: false },
    notes: { type: 'string', required: false }
  }
}), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Don't allow updating certain fields
    const allowedUpdates = ['status', 'items', 'totalAmount', 'shippingAddress', 'paymentMethod', 'notes'];
    const updates = Object.keys(req.body)
      .filter(key => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    // Publish event for async processing
    // await messageBroker.publish(messageBroker.streams.orders, {
    //   type: 'order.updated',
    //   data: { _id: req.params.id, ...updates }
    // });

    res.status(202).json({ 
      message: 'Order update initiated',
      data: { _id: req.params.id, ...updates }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating order', error: error.message });
  }
});

// Delete order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Publish event for async processing
    // await messageBroker.publish(messageBroker.streams.orders, {
    //   type: 'order.deleted',
    //   data: { _id: req.params.id }
    // });

    res.status(202).json({ 
      message: 'Order deletion initiated',
      data: { _id: req.params.id }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting order', error: error.message });
  }
});

// Get customer's orders
router.get('/customer/:customerId', async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.params.customerId })
      .sort({ createdAt: -1 })
      .populate('customer', 'name email phone');

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer orders', error: error.message });
  }
});

module.exports = router; 