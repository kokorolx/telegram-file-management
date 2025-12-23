import { StorageProvider } from './StorageProvider.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

/**
 * S3 Storage Provider with hierarchical credential selection.
 * Supports AWS S3, Cloudflare R2, and other S3-compatible services.
 */
export class S3StorageProvider extends StorageProvider {
  constructor() {
    super();
    this.clientCache = new Map(); // Cache S3 clients by config hash
  }

  /**
   * Get or create an S3 client for the given configuration.
   * @param {Object} s3Config - S3 configuration object.
   * @returns {S3Client}
   */
  getClient(s3Config) {
    const configKey = JSON.stringify(s3Config);
    if (this.clientCache.has(configKey)) {
      return this.clientCache.get(configKey);
    }

    const clientConfig = {
      region: s3Config.region || 'us-east-1',
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    };

    // Support custom endpoints for R2 and other S3-compatible services
    if (s3Config.endpoint) {
      clientConfig.endpoint = s3Config.endpoint;
      clientConfig.forcePathStyle = true; // Required for some S3-compatible services
    }

    const client = new S3Client(clientConfig);
    this.clientCache.set(configKey, client);
    return client;
  }

  /**
   * Get the effective S3 configuration based on hierarchy:
   * Organization -> Personal (if allowed) -> Global
   * @param {Object} user - User object with organization and personal S3 config.
   * @param {Object} orgConfig - Decrypted organization S3 config (if any).
   * @param {Object} personalConfig - Decrypted personal S3 config (if any).
   * @returns {Object|null} - The effective S3 config or null if none.
   */
  getEffectiveConfig(user, orgConfig = null, personalConfig = null) {
    // Priority 1: Organization config (if user belongs to an org)
    if (user?.organization_id && orgConfig) {
      this.validateConfigOrThrow(orgConfig, 'Organization');
      return orgConfig;
    }

    // Priority 2: Personal config (if allowed by global toggle)
    if (config.allowPersonalS3 && personalConfig) {
      this.validateConfigOrThrow(personalConfig, 'Personal');
      return personalConfig;
    }

    // Priority 3: Global config from environment
    if (config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey) {
      const globalConfig = {
        bucket: config.s3Bucket,
        accessKeyId: config.s3AccessKeyId,
        secretAccessKey: config.s3SecretAccessKey,
        region: config.s3Region || 'us-east-1',
        endpoint: config.s3Endpoint || null,
        storageClass: config.s3StorageClass || 'STANDARD',
      };
      this.validateConfigOrThrow(globalConfig, 'Global');
      return globalConfig;
    }

    return null;
  }

  /**
   * Validate S3 configuration and throw if invalid
   * @param {Object} s3Config - S3 configuration to validate
   * @param {string} source - Source label (Organization, Personal, Global) for error messages
   * @throws {Error} if configuration is invalid
   */
  validateConfigOrThrow(s3Config, source = 'S3') {
    if (!s3Config) {
      throw new Error(`${source} S3 configuration is missing`);
    }

    if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
      throw new Error(`${source} S3 configuration is incomplete (missing bucket, accessKeyId, or secretAccessKey)`);
    }

    if (!s3Config.region) {
      throw new Error(`${source} S3 configuration is missing region`);
    }
  }

  /**
   * Upload a chunk to S3.
   * @param {string} userId
   * @param {Buffer} buffer - Encrypted chunk data.
   * @param {string} filename
   * @param {Object} s3Config - Effective S3 configuration.
   * @returns {Promise<string>} S3 object key.
   * @throws {Error} if S3 config is invalid or upload fails
   */
  async uploadChunk(userId, buffer, filename, s3Config = null, fileId = null) {
    if (!s3Config) {
      const error = 'S3 backup configuration is not set up. Please configure S3 storage in Settings > Backup.';
      console.error('[S3] Upload failed:', error);
      throw new Error(error);
    }

    try {
      this.validateConfigOrThrow(s3Config);
      const client = this.getClient(s3Config);
      // Include fileId in path to prevent overwrites of same filename
      // Format: userId/fileId/filename_part_N
      const key = fileId ? `${userId}/${fileId}/${filename}` : `${userId}/${Date.now()}-${filename}`;

      const command = new PutObjectCommand({
        Bucket: s3Config.bucket,
        Key: key,
        Body: buffer,
        ACL: 'private', // Explicitly private
        StorageClass: s3Config.storageClass || 'STANDARD',
      });

      await client.send(command);
      return key;
    } catch (err) {
      console.error('[S3] Upload error:', err);
      throw new Error(`S3 upload failed: ${err.message}`);
    }
  }

  /**
   * Generate a presigned download URL for a chunk.
   * @param {string} userId
   * @param {string} storageId - S3 object key.
   * @param {Object} s3Config - Effective S3 configuration.
   * @returns {Promise<string>} Presigned URL.
   * @throws {Error} if S3 config is invalid or URL generation fails
   */
  async getDownloadUrl(userId, storageId, s3Config = null) {
    if (!s3Config) {
      const error = 'S3 backup configuration is not set up. Cannot generate download URL.';
      console.error('[S3] Download URL generation failed:', error);
      throw new Error(error);
    }

    if (!storageId) {
      const error = 'Storage ID is required to generate download URL.';
      console.error('[S3] Download URL generation failed:', error);
      throw new Error(error);
    }

    try {
      this.validateConfigOrThrow(s3Config);
      const client = this.getClient(s3Config);
      const command = new GetObjectCommand({
        Bucket: s3Config.bucket,
        Key: storageId,
      });

      // 1-hour expiration
      const url = await getSignedUrl(client, command, { expiresIn: 3600 });
      return url;
    } catch (err) {
      console.error('[S3] Download URL generation error:', err);
      throw new Error(`S3 URL generation failed: ${err.message}`);
    }
  }

  /**
   * Delete a chunk from S3.
   * @param {string} storageId - S3 object key.
   * @param {Object} s3Config - Effective S3 configuration.
   * @returns {Promise<boolean>}
   * @throws {Error} if S3 config is invalid or deletion fails
   */
  async deleteChunk(storageId, s3Config = null) {
    if (!s3Config) {
      const error = 'S3 backup configuration is not set up. Cannot delete chunk.';
      console.error('[S3] Delete failed:', error);
      throw new Error(error);
    }

    if (!storageId) {
      const error = 'Storage ID is required to delete chunk.';
      console.error('[S3] Delete failed:', error);
      throw new Error(error);
    }

    try {
      this.validateConfigOrThrow(s3Config);
      const client = this.getClient(s3Config);
      const command = new DeleteObjectCommand({
        Bucket: s3Config.bucket,
        Key: storageId,
      });

      await client.send(command);
      return true;
    } catch (err) {
      console.error('[S3] Delete error:', err);
      throw new Error(`S3 delete failed: ${err.message}`);
    }
  }
}
