const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const { validateRequest } = require('../middleware/validation');
const { auth } = require('../middleware/auth');
const messageBroker = require('../services/messageBroker');

// Get all customers
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query)
      .sort({ [sortBy]: sortOrder });

    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customers', error: error.message });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching customer', error: error.message });
  }
});

// Create new customer
router.post('/', validateRequest({
  body: {
    name: { type: 'string', required: true },
    email: { type: 'string', required: true, format: 'email' },
    phone: { type: 'string', required: true },
    address: { type: 'object', required: false },
    metadata: { type: 'object', required: false }
  }
}), async (req, res) => {
  try {
    const existingCustomer = await Customer.findOne({ 
      $or: [
        { email: req.body.email },
        { phone: req.body.phone }
      ]
    });

    if (existingCustomer) {
      return res.status(400).json({ 
        message: 'Customer with this email or phone already exists' 
      });
    }

    // Publish event for async processing
    await messageBroker.publish(messageBroker.streams.customers, {
      type: 'customer.created',
      data: req.body
    });

    res.status(202).json({ 
      message: 'Customer creation initiated',
      data: req.body
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating customer', error: error.message });
  }
});

// Update customer
router.put('/:id', validateRequest({
  body: {
    name: { type: 'string', required: false },
    email: { type: 'string', required: false, format: 'email' },
    phone: { type: 'string', required: false },
    address: { type: 'object', required: false },
    metadata: { type: 'object', required: false }
  }
}), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Check if email or phone is being updated and if it's already in use
    if (req.body.email || req.body.phone) {
      const existingCustomer = await Customer.findOne({
        _id: { $ne: req.params.id },
        $or: [
          { email: req.body.email || customer.email },
          { phone: req.body.phone || customer.phone }
        ]
      });

      if (existingCustomer) {
        return res.status(400).json({ 
          message: 'Customer with this email or phone already exists' 
        });
      }
    }

    // Publish event for async processing
    await messageBroker.publish(messageBroker.streams.customers, {
      type: 'customer.updated',
      data: { _id: req.params.id, ...req.body }
    });

    res.status(202).json({ 
      message: 'Customer update initiated',
      data: { _id: req.params.id, ...req.body }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating customer', error: error.message });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Publish event for async processing
    await messageBroker.publish(messageBroker.streams.customers, {
      type: 'customer.deleted',
      data: { _id: req.params.id }
    });

    res.status(202).json({ 
      message: 'Customer deletion initiated',
      data: { _id: req.params.id }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting customer', error: error.message });
  }
});

module.exports = router; 