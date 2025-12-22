# S3 Configuration Validation

## Overview

This document describes the S3 backup storage validation system. The system ensures that S3 configurations are complete, valid, and properly formatted before being used.

## Validation Components

### 1. S3ConfigValidator (`lib/validators/S3ConfigValidator.js`)

A utility class that validates S3 configuration objects with comprehensive checks:

#### Methods

**`validate(config, provider)`**
- Validates complete S3 configuration
- Returns: `{ valid: boolean, errors: string[] }`
- Checks:
  - Required fields: `bucket`, `accessKeyId`, `secretAccessKey`
  - Region (required for AWS S3)
  - Endpoint URL format (required for R2 and CUSTOM providers)
  - Storage class (if provided)
  - Bucket name format (AWS S3 naming rules)
  - URL format validation

**`isValidBucketName(name)`**
- Validates S3 bucket naming rules
- Length: 3-63 characters
- Characters: lowercase letters, numbers, hyphens, periods
- Cannot start/end with hyphen or period
- Cannot contain consecutive periods
- Cannot be in IP address format

**`isValidUrl(url)`**
- Validates URL format using URL constructor
- Returns: `boolean`

**`hasRequiredFields(config)`**
- Minimal check for required fields
- Returns: `boolean`

### 2. S3StorageProvider (`lib/storage/S3StorageProvider.js`)

Enhanced error handling and validation:

#### New Methods

**`validateConfigOrThrow(s3Config, source)`**
- Throws error if configuration is invalid
- Parameters:
  - `s3Config`: Configuration object to validate
  - `source`: Label for error messages (Organization, Personal, Global)
- Throws `Error` with descriptive message if:
  - Config object is missing
  - Required fields are missing
  - Region is missing

#### Modified Methods

All storage operations now:
1. Throw descriptive errors instead of returning null
2. Validate configuration before operations
3. Provide clear error messages about what needs to be configured

**`uploadChunk(userId, buffer, filename, s3Config)`**
- Throws: `'S3 backup configuration is not set up. Please configure S3 storage in Settings > Backup.'`
- Validates config before upload
- Wraps in try-catch for AWS SDK errors

**`getDownloadUrl(userId, storageId, s3Config)`**
- Throws separate errors for:
  - Missing config
  - Missing storage ID
  - Invalid configuration
- Validates config before URL generation

**`deleteChunk(storageId, s3Config)`**
- Throws separate errors for:
  - Missing config
  - Missing storage ID
  - Invalid configuration
- Validates config before deletion

### 3. API Endpoint (`app/api/settings/backup/route.js`)

**POST /api/settings/backup**
- Validates S3 configuration before saving
- Returns validation errors with details:
  ```json
  {
    "error": "Invalid S3 configuration",
    "details": [
      "Bucket name is required and must be a non-empty string",
      "Invalid bucket name format"
    ]
  }
  ```

## Error Handling Strategy

### Client-Side
- Users see validation errors when submitting forms
- Errors include specific field information
- Test connection validates credentials

### Server-Side
- API validates configuration on save
- Storage operations validate configuration before attempting access
- Non-critical operations (backup) fail gracefully without affecting main operations

### Integration Points

1. **File Upload** (`app/api/upload/chunk/route.js`)
   - S3 backup is non-blocking
   - Errors logged but don't fail main upload
   - Users can still upload without S3 configured

2. **File Download** (`app/api/chunk/[fileId]/[partNumber]/route.js`)
   - S3 fallback uses try-catch
   - Falls back to Telegram if S3 fails
   - Clear error messages in logs

3. **File Deletion** (`lib/fileService.js`)
   - Wrapped in try-catch
   - Logs warning on S3 delete failure
   - Doesn't fail main deletion

## Configuration Requirements

### AWS S3
- **Provider**: S3
- **Required**:
  - Bucket name (3-63 chars, lowercase, alphanumeric, hyphens, periods)
  - Region
  - Access Key ID
  - Secret Access Key
- **Optional**:
  - Storage Class (default: STANDARD)

### Cloudflare R2
- **Provider**: R2
- **Required**:
  - Bucket name
  - Endpoint URL (https://your-account-id.r2.cloudflarestorage.com)
  - Access Key ID
  - Secret Access Key
- **Optional**:
  - Storage Class (default: STANDARD)
- **Region**: Auto (fixed)

### Custom S3-Compatible
- **Provider**: CUSTOM
- **Required**:
  - Bucket name
  - Endpoint URL
  - Access Key ID
  - Secret Access Key
- **Optional**:
  - Region (default: us-east-1)
  - Storage Class

## User Messages

When S3 is not configured:
```
S3 backup configuration is not set up. Please configure S3 storage in Settings > Backup.
```

When storage ID is missing:
```
Storage ID is required to [upload/download/delete] chunk.
```

When configuration is incomplete:
```
[Organization/Personal/Global] S3 configuration is incomplete (missing bucket, accessKeyId, or secretAccessKey)
```

When validation fails:
```
Invalid S3 configuration
- Bucket name must be 3-63 characters...
- Endpoint must be a valid URL
```

## Testing

To test S3 configuration validation:

1. **Missing Fields Test**
   ```javascript
   const result = S3ConfigValidator.validate({ bucket: '' }, 'S3');
   // result.valid === false
   // result.errors contains validation messages
   ```

2. **Invalid Bucket Name**
   ```javascript
   const result = S3ConfigValidator.validate({
     bucket: 'My-Bucket', // uppercase not allowed
     accessKeyId: 'key',
     secretAccessKey: 'secret',
     region: 'us-east-1'
   }, 'S3');
   ```

3. **Invalid URL**
   ```javascript
   const result = S3ConfigValidator.validate({
     bucket: 'my-bucket',
     endpoint: 'not-a-valid-url',
     accessKeyId: 'key',
     secretAccessKey: 'secret'
   }, 'R2');
   ```

## Best Practices

1. **Always validate on save**: Use validator before persisting configuration
2. **Provide detailed errors**: Include specific field names in error messages
3. **Test connectivity**: Use `/api/settings/backup/test` to verify credentials
4. **Handle gracefully**: Non-critical operations should fail gracefully
5. **Clear user messages**: Tell users where to configure S3 when it's needed
6. **Log appropriately**: Use error logs for configuration issues, warn logs for non-blocking failures
