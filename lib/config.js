import { licenseService } from './services/LicenseService';

export const config = {
  isEnterprise: (process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true' || process.env.IS_ENTERPRISE === 'true') && licenseService.isTokenValidSync(),
  storageBackend: process.env.STORAGE_BACKEND || 'TELEGRAM', // TELEGRAM, S3, HYBRID
  redisUrl: process.env.REDIS_URL,
  videoProcessingUrl: process.env.VIDEO_PROCESSING_URL,
};

export const isEnterprise = () => config.isEnterprise;
