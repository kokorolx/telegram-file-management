/**
 * S3ConfigValidator Test Suite
 * Tests S3 configuration validation logic
 */

import { S3ConfigValidator } from '../S3ConfigValidator.js';

describe('S3ConfigValidator', () => {
  describe('validate()', () => {
    test('should accept valid S3 config', () => {
      const config = {
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };
      const result = S3ConfigValidator.validate(config, 'S3');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should accept valid R2 config', () => {
      const config = {
        bucket: 'my-bucket',
        endpoint: 'https://my-account.r2.cloudflarestorage.com',
        accessKeyId: 'key123',
        secretAccessKey: 'secret123',
      };
      const result = S3ConfigValidator.validate(config, 'R2');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject config with missing bucket', () => {
      const config = {
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };
      const result = S3ConfigValidator.validate(config, 'S3');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Bucket name is required'));
    });

    test('should reject config with missing accessKeyId', () => {
      const config = {
        bucket: 'my-bucket',
        region: 'us-east-1',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };
      const result = S3ConfigValidator.validate(config, 'S3');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Access Key ID is required'));
    });

    test('should reject config with missing secretAccessKey', () => {
      const config = {
        bucket: 'my-bucket',
        region: 'us-east-1',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      };
      const result = S3ConfigValidator.validate(config, 'S3');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Secret Access Key is required'));
    });

    test('should reject S3 config without region', () => {
      const config = {
        bucket: 'my-bucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      };
      const result = S3ConfigValidator.validate(config, 'S3');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Region is required for AWS S3'));
    });

    test('should reject R2 config without endpoint', () => {
      const config = {
        bucket: 'my-bucket',
        accessKeyId: 'key123',
        secretAccessKey: 'secret123',
      };
      const result = S3ConfigValidator.validate(config, 'R2');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Endpoint URL is required for R2'));
    });

    test('should reject config with invalid endpoint URL', () => {
      const config = {
        bucket: 'my-bucket',
        endpoint: 'not-a-valid-url',
        accessKeyId: 'key123',
        secretAccessKey: 'secret123',
      };
      const result = S3ConfigValidator.validate(config, 'R2');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Endpoint must be a valid URL'));
    });

    test('should reject null config', () => {
      const result = S3ConfigValidator.validate(null, 'S3');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Configuration object is required');
    });
  });

  describe('isValidBucketName()', () => {
    test('should accept valid bucket names', () => {
      expect(S3ConfigValidator.isValidBucketName('my-bucket')).toBe(true);
      expect(S3ConfigValidator.isValidBucketName('my.bucket')).toBe(true);
      expect(S3ConfigValidator.isValidBucketName('bucket123')).toBe(true);
      expect(S3ConfigValidator.isValidBucketName('a3-b.c')).toBe(true);
    });

    test('should reject bucket names with uppercase', () => {
      expect(S3ConfigValidator.isValidBucketName('My-Bucket')).toBe(false);
      expect(S3ConfigValidator.isValidBucketName('MyBucket')).toBe(false);
    });

    test('should reject bucket names that are too short', () => {
      expect(S3ConfigValidator.isValidBucketName('ab')).toBe(false);
    });

    test('should reject bucket names that are too long', () => {
      expect(S3ConfigValidator.isValidBucketName('a'.repeat(64))).toBe(false);
    });

    test('should reject bucket names starting with hyphen', () => {
      expect(S3ConfigValidator.isValidBucketName('-bucket')).toBe(false);
    });

    test('should reject bucket names ending with hyphen', () => {
      expect(S3ConfigValidator.isValidBucketName('bucket-')).toBe(false);
    });

    test('should reject bucket names starting with period', () => {
      expect(S3ConfigValidator.isValidBucketName('.bucket')).toBe(false);
    });

    test('should reject bucket names ending with period', () => {
      expect(S3ConfigValidator.isValidBucketName('bucket.')).toBe(false);
    });

    test('should reject bucket names with consecutive periods', () => {
      expect(S3ConfigValidator.isValidBucketName('my..bucket')).toBe(false);
    });

    test('should reject bucket names in IP format', () => {
      expect(S3ConfigValidator.isValidBucketName('192.168.1.1')).toBe(false);
    });

    test('should reject bucket names with invalid characters', () => {
      expect(S3ConfigValidator.isValidBucketName('my_bucket')).toBe(false);
      expect(S3ConfigValidator.isValidBucketName('my bucket')).toBe(false);
      expect(S3ConfigValidator.isValidBucketName('my@bucket')).toBe(false);
    });
  });

  describe('isValidUrl()', () => {
    test('should accept valid URLs', () => {
      expect(S3ConfigValidator.isValidUrl('https://example.com')).toBe(true);
      expect(S3ConfigValidator.isValidUrl('https://my-account.r2.cloudflarestorage.com')).toBe(true);
      expect(S3ConfigValidator.isValidUrl('http://localhost:3000')).toBe(true);
      expect(S3ConfigValidator.isValidUrl('https://s3.us-east-1.amazonaws.com')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(S3ConfigValidator.isValidUrl('not-a-url')).toBe(false);
      expect(S3ConfigValidator.isValidUrl('://invalid')).toBe(false);
      expect(S3ConfigValidator.isValidUrl('')).toBe(false);
    });
  });

  describe('hasRequiredFields()', () => {
    test('should return true for config with required fields', () => {
      const config = {
        bucket: 'my-bucket',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
      };
      expect(S3ConfigValidator.hasRequiredFields(config)).toBe(true);
    });

    test('should return false for config with missing fields', () => {
      expect(S3ConfigValidator.hasRequiredFields({})).toBe(false);
      expect(S3ConfigValidator.hasRequiredFields({
        bucket: 'my-bucket',
        accessKeyId: 'key',
      })).toBe(false);
    });

    test('should return false for null config', () => {
      expect(S3ConfigValidator.hasRequiredFields(null)).toBe(false);
    });

    test('should return false for empty string values', () => {
      expect(S3ConfigValidator.hasRequiredFields({
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
      })).toBe(false);
    });
  });
});
