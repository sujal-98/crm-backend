const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });  }

  async generateCampaignMessage(campaignContext) {
    try {
      const prompt = `Generate a personalized marketing message for a campaign with the following context:
      - Target audience: ${campaignContext.audience}
      - Campaign purpose: ${campaignContext.purpose}
      - Tone: Professional and engaging
      - Include personalization placeholder: {customerName}
      - Keep it under 160 characters
      
      Generate 3 different variations of the message.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const suggestions = text.split(/\d\./).filter(msg => msg.trim().length > 0);

      return suggestions;
    } catch (error) {
      console.error('Error generating campaign message:', error);
      throw error;
    }
  }
}

module.exports = new GeminiService(); 