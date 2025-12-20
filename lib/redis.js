import Redis from 'ioredis';
import { config } from './config.js';

let redis = null;

export const getRedisClient = () => {
  if (!config.redisUrl) return null;

  if (!redis) {
    redis = new Redis(config.redisUrl);
    redis.on('error', (err) => console.error('Redis error:', err));
  }
  return redis;
};
