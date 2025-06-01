const express = require('express');
const router = express.Router();
const Segment = require('../models/Segment');
const { isAuthenticated } = require('../middleware/auth');
const customerSegmentation = require('../services/customerSegmentation');

// Create a new segment
router.post('/', async (req, res) => {
  try {
    console.log('Creating new segment with data:', req.body);
    const { segment, matchingCustomers } = await customerSegmentation.buildSegment(req.body, req.user.email);
    
    res.status(201).json({
      status: 'success',
      data: {
        segment,
        customerCount: matchingCustomers.length
      }
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get segments by email
router.get('/:email', isAuthenticated, async (req, res) => {
  try {
    const segments = await Segment.find({ createdBy: req.params.email })
      .select('name rules conditionString customerIds createdAt')
      .lean();

    res.json({
      status: 'success',
      data: {
        segments,
        count: segments.length
      }
    });
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add the save endpoint
router.post('/save', isAuthenticated, async (req, res) => {
  try {
    console.log('Saving segment with data:', req.body);
    
    const { rules, name, conditionString, customerIds, audienceSize } = req.body;
    
    // Create the segment directly with provided customer IDs
    const segment = await Segment.create({
      name,
      rules,
      conditionString,
      customerIds,
      audienceSize,
      createdBy: req.user.email
    });

    res.status(201).json({
      status: 'success',
      data: {
        segment,
        customerCount: customerIds.length
      }
    });
  } catch (error) {
    console.error('Error saving segment:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router; 