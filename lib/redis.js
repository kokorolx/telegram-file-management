import Redis from 'ioredis';
import { config } from './config.js';

let redis = null;

export const getRedisClient = () => {
    if (!config.redisUrl) {
        console.warn('Redis URL not configured. Skipping Redis connection.');
        return null;
    }

    if (!redis) {
        try {
            redis = new Redis(config.redisUrl, {
                // Production-ready defaults
                retryStrategy: (times) => {
                    const delay = Math.min(times * 50, 2000);
                    return delay;
                },
                maxRetriesPerRequest: 3,
                enableReadyCheck: false // Faster startup
            });

            redis.on('error', (err) => {
                // Suppress ECONNREFUSED logs to avoid spamming if Redis is optional/down
                if (err.code === 'ECONNREFUSED') {
                    console.error(`Redis connection refused at ${config.redisUrl}. Is Redis running?`);
                } else {
                    console.error('Redis error:', err);
                }
            });

            redis.on('connect', () => {
                console.log('Connected to Redis successfully');
            });
        } catch (error) {
            console.error('Failed to initialize Redis client:', error);
            return null;
        }
    }
    return redis;
};
