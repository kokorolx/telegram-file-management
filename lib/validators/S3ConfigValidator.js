/**
 * S3 Configuration Validator
 * Validates S3 backup configuration for required fields and format
 */

export class S3ConfigValidator {
  /**
   * Validate S3 configuration object
   * @param {Object} config - S3 configuration to validate
   * @param {string} provider - Provider type: 'S3', 'R2', or 'CUSTOM'
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  static validate(config, provider = 'S3') {
    const errors = [];

    if (!config) {
      errors.push('Configuration object is required');
      return { valid: false, errors };
    }

    // Required fields for all providers
    if (!config.bucket || typeof config.bucket !== 'string' || config.bucket.trim() === '') {
      errors.push('Bucket name is required and must be a non-empty string');
    }

    if (!config.accessKeyId || typeof config.accessKeyId !== 'string' || config.accessKeyId.trim() === '') {
      errors.push('Access Key ID is required and must be a non-empty string');
    }

    if (!config.secretAccessKey || typeof config.secretAccessKey !== 'string' || config.secretAccessKey.trim() === '') {
      errors.push('Secret Access Key is required and must be a non-empty string');
    }

    // Region validation for S3
    if (provider === 'S3') {
      if (!config.region || typeof config.region !== 'string' || config.region.trim() === '') {
        errors.push('Region is required for AWS S3');
      }
    }

    // Endpoint validation for R2 and CUSTOM
    if (provider === 'R2' || provider === 'CUSTOM') {
      if (!config.endpoint || typeof config.endpoint !== 'string' || config.endpoint.trim() === '') {
        errors.push(`Endpoint URL is required for ${provider}`);
      } else if (!this.isValidUrl(config.endpoint)) {
        errors.push('Endpoint must be a valid URL');
      }
    }

    // Storage class validation if provided
    if (config.storageClass && typeof config.storageClass !== 'string') {
      errors.push('Storage class must be a string');
    }

    // Bucket name format validation
    if (config.bucket) {
      if (!this.isValidBucketName(config.bucket)) {
        errors.push('Bucket name must be 3-63 characters, lowercase letters, numbers, hyphens, and periods. Cannot start/end with hyphen or period.');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate bucket name format (AWS S3 rules)
   * @param {string} name - Bucket name
   * @returns {boolean}
   */
  static isValidBucketName(name) {
    if (!name || name.length < 3 || name.length > 63) return false;
    if (!/^[a-z0-9.-]+$/.test(name)) return false;
    if (name.startsWith('-') || name.endsWith('-')) return false;
    if (name.startsWith('.') || name.endsWith('.')) return false;
    if (name.includes('..')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(name)) return false; // IP address format
    return true;
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean}
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if required fields are present (for minimal validation)
   * @param {Object} config - Configuration to check
   * @returns {boolean}
   */
  static hasRequiredFields(config) {
    return !!(
      config &&
      config.bucket &&
      config.accessKeyId &&
      config.secretAccessKey
    );
  }
}
