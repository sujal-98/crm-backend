require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 4000,
  apiUrl: process.env.API_URL || 'https://crm-application-ictu.onrender.com',
  frontendUrl: process.env.FRONTEND_URL || 'https://crm-application-ictu.onrender.com',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/xenocrm',
  },

  // Comment out Redis for deployment
  // redis: {
  //   url: process.env.REDIS_URL || 'redis://localhost:6379',
  // },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'https://crm-backend-y93k.onrender.com/api/auth/google/callback',
    redirectUrl: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/auth/callback` : 'https://crm-application-ictu.onrender.com/auth/callback'
  },

  // OpenAI
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'debug',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

module.exports = config; 