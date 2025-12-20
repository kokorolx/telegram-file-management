import { dataSource } from '../data-source';
import { getRedisClient } from '../redis';
import { Queue } from 'bullmq';
import { config } from '../config';

export class HealthService {
  /**
   * Performs a comprehensive check of all infrastructure components.
   */
  async getSystemHealth() {
    const health = {
      database: 'DOWN',
      redis: 'DOWN',
      worker: 'OFFLINE',
      timestamp: new Date().toISOString(),
    };

    // 1. Check Database
    try {
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }
      await dataSource.query('SELECT 1');
      health.database = 'UP';
    } catch (err) {
      console.error('HealthCheck: DB Error', err);
    }

    // 2. Check Redis
    let redisClient;
    try {
      redisClient = getRedisClient();
      if (redisClient) {
        const ping = await redisClient.ping();
        if (ping === 'PONG') {
          health.redis = 'UP';
        }
      }
    } catch (err) {
      console.error('HealthCheck: Redis Error', err);
    }

    // 3. Check Video Worker (if enterprise/self-host enabled)
    try {
      if (health.redis === 'UP') {
        const videoQueue = new Queue('video-processing', {
          connection: { url: config.redisUrl }
        });
        const workers = await videoQueue.getWorkers();
        health.worker = workers.length > 0 ? 'ONLINE' : 'OFFLINE';
        await videoQueue.close();
      }
    } catch (err) {
      console.error('HealthCheck: Worker Error', err);
    }

    return health;
  }

  /**
   * Returns job counts for the video processing queue.
   */
  async getQueueStats() {
    try {
        const videoQueue = new Queue('video-processing', {
            connection: { url: config.redisUrl }
        });
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            videoQueue.getWaitingCount(),
            videoQueue.getActiveCount(),
            videoQueue.getCompletedCount(),
            videoQueue.getFailedCount(),
            videoQueue.getDelayedCount()
        ]);
        await videoQueue.close();
        return { waiting, active, completed, failed, delayed };
    } catch (err) {
        console.error('HealthCheck: Queue Stats Error', err);
        return null;
    }
  }

  /**
   * Determines what features are safe to run based on current health.
   */
  async getSystemCapabilities() {
    const [health, queue] = await Promise.all([
        this.getSystemHealth(),
        this.getQueueStats()
    ]);

    return {
      can_upload: health.database === 'UP',
      can_process_video: health.redis === 'UP' && health.worker === 'ONLINE',
      can_use_sessions: health.redis === 'UP',
      health,
      queue
    };
  }
}

export const healthService = new HealthService();
