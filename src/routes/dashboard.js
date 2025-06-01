const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');
const Segment = require('../models/Segment');
const Customer = require('../models/Customer');

router.get('/stats', async (req, res) => {
  try {
    const { email } = req.query;
    console.log('Fetching stats for email:', email);

    if (!email) {
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    // Get total customers
    const totalCustomers = await Customer.countDocuments();
    console.log('Total customers:', totalCustomers);

    // Get segments count and recent segments for the specific user
    const segments = await Segment.countDocuments({ createdBy: email });
    const recentSegments = await Segment.find({ createdBy: email })
      .sort({ createdAt: -1 })
      .limit(5);
    console.log('Total segments for user:', segments);

    // Get last 10 completed campaigns
    const lastTenCampaigns = await Campaign.find({ 
      createdBy: email,
      status: 'COMPLETED'
    })
    .sort({ createdAt: -1 })
    .limit(10);
    console.log('Last 10 campaigns:', lastTenCampaigns);

    // Calculate campaign success metrics
    const campaignStats = lastTenCampaigns.reduce((acc, campaign) => {
      const sent = campaign.stats?.final?.sent || campaign.stats?.sent || 0;
      const failed = campaign.stats?.final?.failed || campaign.stats?.failed || 0;
      
      acc.totalSent += sent;
      acc.totalFailed += failed;
      
      console.log(`Campaign ${campaign.name}: sent=${sent}, failed=${failed}`);
      return acc;
    }, { totalSent: 0, totalFailed: 0 });

    console.log('Campaign stats:', campaignStats);

    // Get total campaigns count (including all statuses)
    const totalCampaigns = await Campaign.countDocuments({ createdBy: email });
    console.log('Total campaigns:', totalCampaigns);

    // Get recent campaigns (including all statuses)
    const recentCampaigns = await Campaign.find({ createdBy: email })
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate success rate
    const totalMessages = campaignStats.totalSent + campaignStats.totalFailed;
    const successRate = totalMessages > 0 
      ? ((campaignStats.totalSent / totalMessages) * 100).toFixed(1) 
      : 0;

    // Prepare campaign performance data
    const campaignPerformance = lastTenCampaigns.slice(0, 3).map(campaign => ({
      name: campaign.name,
      sent: campaign.stats?.final?.sent || campaign.stats?.sent || 0,
      failed: campaign.stats?.final?.failed || campaign.stats?.failed || 0
    }));

    const response = {
      status: 'success',
      data: {
        overview: {
          totalCustomers,
          totalSegments: segments,
          totalCampaigns,
          messagesSent: campaignStats.totalSent,
          messagesFailed: campaignStats.totalFailed,
          successRate
        },
        recentCampaigns,
        recentSegments,
        campaignPerformance
      }
    };

    console.log('Sending response:', response);
    res.json(response);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
});

module.exports = router; 