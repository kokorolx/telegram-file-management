import { licenseService } from './services/LicenseService';

export const config = {
  isEnterprise: (process.env.NEXT_PUBLIC_IS_ENTERPRISE === 'true' || process.env.IS_ENTERPRISE === 'true') && licenseService.isTokenValidSync(),
  storageBackend: process.env.STORAGE_BACKEND || 'TELEGRAM', // TELEGRAM, S3, HYBRID, LOCAL
  redisUrl: process.env.REDIS_URL,
  videoProcessingUrl: process.env.VIDEO_PROCESSING_URL,
  // S3/R2 Backup Configuration
  s3Endpoint: process.env.S3_ENDPOINT || null,
  s3Region: process.env.S3_REGION || 'us-east-1',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || null,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || null,
  s3Bucket: process.env.S3_BUCKET || null,
  s3StorageClass: process.env.S3_STORAGE_CLASS || 'STANDARD',
  allowPersonalS3: process.env.ALLOW_PERSONAL_S3 === 'true',
};

export const isEnterprise = () => config.isEnterprise;
