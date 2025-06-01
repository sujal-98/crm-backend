const express = require('express');
const router = express.Router();
const campaignService = require('../services/campaignService');
const { isAuthenticated } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Segment = require('../models/Segment');
const Campaign = require('../models/Campaign');

// Create and start a new campaign
router.post('/', async (req, res) => {
  try {
    const { segmentId, messageTemplate, email, name, audienceSize } = req.body;
    console.log(req.body);
    // Validate required fields
    if (!segmentId || !messageTemplate || !email || !name || !audienceSize) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }

    const campaign = await campaignService.createCampaign({
      name,
      segmentId,
      messageTemplate,
      audienceSize,
      createdBy: email
    });

    res.status(201).json({
      status: 'success',
      data: campaign
    });
  } catch (error) {
    console.error('Error creating and starting campaign:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get campaign statistics
router.get('/:id/stats', isAuthenticated, async (req, res) => {
  try {
    const stats = await campaignService.getCampaignStats(req.params.id);
    
    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Example function to create a segment
async function createSegment(req, res) {
  try {
    const { name, criteria } = req.body;

    // Find matching customers
    const matchingCustomers = await Customer.find(criteria);
    const customerIds = matchingCustomers.map(customer => customer._id);

    // Create the segment with customer IDs
    const segment = await Segment.create({
      name,
      criteria,
      customerIds
    });

    res.status(200).json({ status: 'success', segment });
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

// Get all campaigns for a user
router.get('/', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    const campaigns = await Campaign.find({ createdBy: email })
      .sort({ createdAt: -1 }); // Most recent first

    res.json({
      status: 'success',
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router; 