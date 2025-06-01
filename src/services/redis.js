const Redis = require('ioredis');

// Redis configuration
const redisConfig = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    retryStrategy: (times) => {
        // Exponential backoff retry strategy
        return Math.min(times * 50, 2000);
    }
};

// Create Redis client
const redis = new Redis(redisConfig);

// Error handling
redis.on('error', (err) => {
    console.error('Redis Client Error', err);
});

// Connection success logging
redis.on('connect', () => {
    console.log('Connected to Redis');
});

// Basic utility methods
module.exports = {
    // Set a key with optional expiration
    set: async (key, value, expiry = null) => {
        if (expiry) {
            await redis.set(key, value, 'EX', expiry);
        } else {
            await redis.set(key, value);
        }
    },

    // Get a key's value
    get: async (key) => {
        return await redis.get(key);
    },

    // Set key only if it doesn't exist
    setnx: async (key, value) => {
        return await redis.setnx(key, value);
    },

    // Set expiration for a key
    expire: async (key, seconds) => {
        await redis.expire(key, seconds);
    },

    // Delete a key
    del: async (key) => {
        await redis.del(key);
    },

    // Close Redis connection
    quit: async () => {
        await redis.quit();
    }
}; 