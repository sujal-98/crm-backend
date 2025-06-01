const express = require('express');
const router = express.Router();
const CustomerSegmentation = require('../services/customerSegmentation');
const Segment = require('../models/Segment');
const Campaign = require('../models/Campaign');
const CommunicationLog = require('../models/CommunicationLog');
const axios = require('axios');
const { isAuthenticated } = require('../middleware/auth');

/**
 * @route POST /api/segmentation/count
 * @desc Get the count of customers matching segmentation rules
 * @access Private
 */
router.post('/count', isAuthenticated, async (req, res) => {
  try {
    const { rules, options = {} } = req.body;

    // Validate rules
    let validation;
    try {
      validation = CustomerSegmentation.validateRules(rules);
    } catch (validationError) {
      console.error('Validation Error:', validationError);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid segmentation rules structure',
        errorDetails: validationError.message
      });
    }

    // Check validation results
    if (!validation.isValid) {
      console.warn('Segmentation Rules Validation Errors:', validation.errors);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid segmentation rules',
        errors: validation.errors
      });
    }

    // Get detailed audience calculation
    let audienceResult;
    try {
      audienceResult = await CustomerSegmentation.getCustomerCount(rules);
    } catch (calculationError) {
      console.error('Audience Calculation Error:', calculationError);
      return res.status(500).json({
        status: 'error',
        message: 'Error calculating segment count',
        errorDetails: calculationError.message
      });
    }

    res.json({ 
      status: 'success', 
      data: audienceResult
    });
  } catch (error) {
    console.error('Unexpected Segmentation Count Error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: 'Unexpected error in segment calculation',
      errorDetails: error.message
    });
  }
});

/**
 * @route POST /api/segmentation/list
 * @desc Get the list of customers matching segmentation rules
 * @access Private
 */
router.post('/list', isAuthenticated, async (req, res) => {
  try {
    const { rules, options = {} } = req.body;

    // Validate rules
    const validation = CustomerSegmentation.validateRules(rules);
    if (!validation.isValid) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid segmentation rules',
        errors: validation.errors
      });
    }

    // Get detailed audience calculation
    const audienceResult = await CustomerSegmentation.getCustomerCount(rules);

    res.json({ 
      status: 'success', 
      data: audienceResult
    });
  } catch (error) {
    console.error('Segmentation list error:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message
    });
  }
});

/**
 * @route POST /api/segmentation
 * @desc Create a new segment
 * @access Private
 */
router.post('/', isAuthenticated, async (req, res) => {
  try {
    const { name, operator, rules } = req.body;

    // Validate input
    if (!name || !rules || !Array.isArray(rules) || rules.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid segment data'
      });
    }

    // Create segment
    const segment = new Segment({
      name,
      operator: operator || 'AND',
      rules,
      createdBy: req.user._id
    });

    // Calculate initial audience size
    const audienceResult = await CustomerSegmentation.getCustomerCount({
      operator,
      rules
    });

    segment.audienceSize = audienceResult.totalCount;

    // Save segment
    await segment.save();

    res.status(201).json({
      status: 'success',
      data: segment
    });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route GET /api/segmentation/:id
 * @desc Get segment details
 * @access Private
 */
router.get('/:id', isAuthenticated, async (req, res) => {
  try {
    const segment = await Segment.findById(req.params.id);
    if (!segment) {
      return res.status(404).json({
        status: 'error',
        message: 'Segment not found'
      });
    }

    res.json({
      status: 'success',
      data: segment
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route GET /api/segmentation
 * @desc Get all segments
 */
router.get('/:email', async (req, res) => {
  try {
    const email = req.params.email;
    console.log('Fetching segments for:', email);
    const segments = await Segment.find({ createdBy: email }).sort({ createdAt: -1 });
    console.log('Segments found:', segments);
    res.json({
      status: 'success',
      data: segments
    });
  } catch (error) {
    console.error('Error fetching segments:', error); // <--- This will print the real error
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});
/**
 * @route PUT /api/segmentation/:id
 * @desc Update segment
 * @access Private
 */
router.put('/:id', isAuthenticated, async (req, res) => {
  try {
    const { name, operator, rules } = req.body;
    const segment = await Segment.findById(req.params.id);

    if (!segment) {
      return res.status(404).json({
        status: 'error',
        message: 'Segment not found'
      });
    }

    // Update fields
    if (name) segment.name = name;
    if (operator) segment.operator = operator;
    if (rules) {
      segment.rules = rules;
      // Recalculate audience size
      const audienceResult = await CustomerSegmentation.getCustomerCount({
        operator: segment.operator,
        rules: segment.rules
      });
      segment.audienceSize = audienceResult.totalCount;
    }

    await segment.save();

    res.json({
      status: 'success',
      data: segment
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route DELETE /api/segmentation/:id
 * @desc Delete segment
 * @access Private
 */
router.delete('/:id', isAuthenticated, async (req, res) => {
  try {
    const segment = await Segment.findByIdAndDelete(req.params.id);
    
    if (!segment) {
      return res.status(404).json({
        status: 'error',
        message: 'Segment not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Segment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route POST /api/campaigns/start
 * @desc Simulate campaign creation and message sending for a segment
 * @access Private
 */
router.post('/campaigns/start', async (req, res) => {
  try {
    const { segmentId, messageTemplate, email, audienceSize } = req.body;
    if (!segmentId || !messageTemplate || !email || !audienceSize) {
      return res.status(400).json({ success: false, message: 'segmentId, messageTemplate, email, and audienceSize are required' });
    }

    // Create campaign
    const campaign = await Campaign.create({
      segmentId,
      name: `Campaign for segment ${segmentId}`,
      messageTemplate,
      createdBy: email,
      audienceSize
    });

    // Simulate deliveries
    const stats = await simulateCampaignDelivery(campaign._id, audienceSize, messageTemplate);

    res.json({ success: true, campaign, stats });
  } catch (error) {
    console.error('Error starting campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to start campaign', error: error.message });
  }
});

/**
 * @route POST /api/vendor/receipt
 * @desc Simulated vendor delivery receipt endpoint
 */
router.post('/vendor/receipt', async (req, res) => {
  try {
    const { logId, status } = req.body;
    if (!logId || !status) {
      return res.status(400).json({ success: false, message: 'logId and status are required' });
    }
    await CommunicationLog.findByIdAndUpdate(logId, { status, updatedAt: new Date() });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating delivery receipt:', error);
    res.status(500).json({ success: false, message: 'Failed to update delivery receipt', error: error.message });
  }
});

/**
 * @route GET /api/campaigns/all
 * @desc Get all campaigns sorted by latest
 */
router.get('/campaigns/all', async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 });
    res.json({ success: true, campaigns });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch campaigns', error: error.message });
  }
});

module.exports = router; 