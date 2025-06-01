// Comment out Redis for deployment
// const Redis = require('redis');

// const redisClient = Redis.createClient({
//   url: process.env.REDIS_URL || 'redis://localhost:6379'
// });

// redisClient.on('error', (err) => console.log('Redis Client Error', err));
// redisClient.on('connect', () => console.log('Connected to Redis'));

// const connectRedis = async () => {
//   try {
//     await redisClient.connect();
//   } catch (err) {
//     console.error('Redis connection error:', err);
//   }
// };

// module.exports = { redisClient, connectRedis };

// Export empty object for deployment
module.exports = {
  redisClient: {
    connect: async () => {},
    on: () => {},
    quit: async () => {}
  },
  connectRedis: async () => {}
}; 