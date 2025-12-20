export const config = {
  isEnterprise: process.env.IS_ENTERPRISE === 'true',
  storageBackend: process.env.STORAGE_BACKEND || 'TELEGRAM', // TELEGRAM, S3, HYBRID
  redisUrl: process.env.REDIS_URL,
  videoProcessingUrl: process.env.VIDEO_PROCESSING_URL,
};

export const isEnterprise = () => config.isEnterprise;
