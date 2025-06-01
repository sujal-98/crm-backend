const Campaign = require('../models/Campaign');
const CommunicationLog = require('../models/CommunicationLog');
const Customer = require('../models/Customer');
const Segment = require('../models/Segment');
const vendorApi = require('./vendorApi');
const { v4: uuidv4 } = require('uuid');

class CampaignService {
  async createCampaign(data) {
    const campaign = new Campaign({
      name: data.name,
      segmentId: data.segmentId,
      messageTemplate: data.messageTemplate,
      createdBy: data.createdBy,
      audienceSize: data.audienceSize
    });

    await campaign.save();
    return await this.startCampaign(campaign._id);
  }

  async startCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get customers from segment
    const segment = await Segment.findById(campaign.segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }

    campaign.status = 'RUNNING';
    campaign.startedAt = new Date();
    campaign.stats.total = campaign.audienceSize;
    await campaign.save();

    const customerIds = segment.customerIds;
    const customerList = await Promise.all(
      customerIds.map(async (customerId) => {
        const customer = await Customer.findById(customerId);
        return customer;
      })
    );

    // Create communication logs for each customer
    const communicationLogs = customerList.map(customer => ({
      campaignId: campaign._id,
      customerId: customer._id,
      message: this.personalizeMessage(campaign.messageTemplate, customer),
      messageId: uuidv4(),
      status: 'PENDING'
    }));

    // Batch insert communication logs
    await CommunicationLog.insertMany(communicationLogs);

    // Start sending messages in batches (non-blocking)
    this.processCampaignMessages(campaign._id, communicationLogs)
      .catch(error => console.error('Error processing campaign messages:', error));

    return campaign;
  }

  async processCampaignMessages(campaignId, communicationLogs, batchSize = 50) {
    try {
      // Process in batches
      for (let i = 0; i < communicationLogs.length; i += batchSize) {
        const batch = communicationLogs.slice(i, i + batchSize);
        
        // Send messages through vendor API
        for (const log of batch) {
          try {
            const response = await vendorApi.sendMessage(log.message, log.customerId);
            
            // Update communication log with vendor response
            await CommunicationLog.findOneAndUpdate(
              { messageId: log.messageId },
              {
                $set: {
                  vendorResponse: response,
                  status: 'SENT',
                  sentAt: new Date(),
                  deliveryAttempts: 1
                }
              }
            );

            // Update campaign stats
            await Campaign.findByIdAndUpdate(campaignId, {
              $inc: { 'stats.sent': 1 }
            });

          } catch (error) {
            console.error(`Failed to send message ${log.messageId}:`, error);
            
            // Update communication log for failed message
            await CommunicationLog.findOneAndUpdate(
              { messageId: log.messageId },
              {
                $set: {
                  status: 'FAILED',
                  deliveryAttempts: 1,
                  vendorResponse: { error: error.message }
                }
              }
            );

            // Update campaign stats for failed messages
            await Campaign.findByIdAndUpdate(campaignId, {
              $inc: { 'stats.failed': 1 }
            });
          }
        }

        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Update campaign status to completed
      await Campaign.findByIdAndUpdate(campaignId, {
        $set: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Error processing campaign messages:', error);
      await Campaign.findByIdAndUpdate(campaignId, {
        $set: {
          status: 'FAILED',
          completedAt: new Date()
        }
      });
      throw error;
    }
  }

  personalizeMessage(template, customer) {
    return template.replace(/{{\s*(\w+)\s*}}/g, (match, field) => {
      return customer[field] || match;
    });
  }

  async getCampaignStats(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const stats = await CommunicationLog.aggregate([
      { $match: { campaignId: campaign._id } },
      { 
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      campaignName: campaign.name,
      total: campaign.stats.total,
      status: campaign.status,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
      deliveryStats: stats.reduce((acc, stat) => {
        acc[stat._id.toLowerCase()] = stat.count;
        return acc;
      }, {})
    };
  }
}

// Export a new instance of the service
module.exports = new CampaignService();