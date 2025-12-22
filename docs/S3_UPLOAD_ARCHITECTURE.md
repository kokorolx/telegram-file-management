# S3 Upload Architecture

## Overview

File uploads to S3 backup storage are handled entirely on the **server-side** for security and simplicity. The browser encrypts the file and sends it to the server; the server then:
1. Stores the encrypted chunk in Telegram (primary storage)
2. Mirrors it to S3 (backup storage, if configured)

## Architecture

```
┌─────────────────────────────────────────┐
│ Browser (Client)                        │
│                                         │
│  1. Read file                           │
│  2. Encrypt with AES-256-GCM            │
│  3. Send to server ──────────┐          │
└─────────────────────────────┼──────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Server (Node.js) │
                    │                  │
                    │ 1. Receive        │
                    │    encrypted      │
                    │    chunk          │
                    │                   │
                    │ 2. Upload to      │
                    │    Telegram       │
                    │    (primary)      │
                    │                   │
                    │ 3. Upload to S3   │
                    │    (backup, if    │
                    │    configured)    │
                    └──────────────────┘
```

## Configuration

### Why Global S3 Only?

There are two types of S3 configs:

1. **Global S3** (Admin configured via environment variables)
   - Stored in: Environment variables
   - Encryption: None (plain text in env)
   - Server access: ✅ Direct access (no decryption needed)
   - Use for uploads: ✅ Yes

2. **Personal S3** (User configured via Settings UI)
   - Stored in: Database (encrypted with master password)
   - Encryption: AES-256-GCM encrypted
   - Server access: ❌ Cannot decrypt (master password is browser-only)
   - Use for uploads: ❌ No (server can't decrypt)

**Current implementation uses ONLY global S3** because:
- Server can directly access environment variables
- No decryption key needed
- Admin controls which S3 bucket receives backups
- Secure and simple

### Environment Variables (Required for S3)

```bash
S3_BUCKET=my-backup-bucket
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=...
S3_REGION=us-east-1          # Optional, defaults to us-east-1
S3_ENDPOINT=                 # Optional, for S3-compatible services (R2, MinIO, etc.)
S3_STORAGE_CLASS=STANDARD    # Optional, defaults to STANDARD
```

### Supported Providers

1. **AWS S3**
   - Set: `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `S3_ENDPOINT` not needed

2. **Cloudflare R2**
   - Set: `S3_ENDPOINT=https://{account-id}.r2.cloudflarestorage.com`
   - Set: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `S3_REGION` is ignored (R2 is globally distributed)

3. **Other S3-Compatible** (MinIO, Wasabi, etc.)
   - Set: `S3_ENDPOINT=` to service URL
   - Set: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - Set: `S3_REGION` if applicable

## Upload Flow

### Step 1: Browser Encryption
```javascript
// File is encrypted on browser
const { encrypted_data, iv, auth_tag } = await encryptChunk(fileData, encryptionKey);

// Send to server
POST /api/upload/chunk {
  file_id: "...",
  part_number: 1,
  total_parts: 10,
  encrypted_data: "base64...",  // Never plaintext
  iv: "hex...",
  auth_tag: "hex...",
  ...
}
```

### Step 2: Server Storage - Telegram (Always)
```javascript
// Server receives encrypted chunk
const encryptedBuffer = Buffer.from(encrypted_data, 'base64');

// Upload to Telegram (primary storage)
const storageId = await storageProvider.uploadChunk(userId, encryptedBuffer, filename);
// Result: Stored in Telegram bot as file
```

### Step 3: Server Storage - S3 (If Configured)
```javascript
// Non-blocking backup upload
if (config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey) {
  const s3Provider = new S3StorageProvider();
  const s3Config = {
    bucket: config.s3Bucket,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    region: config.s3Region || 'us-east-1',
    endpoint: config.s3Endpoint || null,
    storageClass: config.s3StorageClass || 'STANDARD'
  };

  // This is non-blocking - doesn't fail the main upload
  const backupStorageId = await s3Provider.uploadChunk(userId, encryptedBuffer, filename, s3Config);
}
```

### Step 4: Database Recording
```javascript
// Store metadata in database
await fileService.handleUploadChunk(userId, {
  file_id: "...",
  part_number: 1,
  total_parts: 10,
  telegram_file_id: storageId,      // From Telegram upload
  backup_storage_id: backupStorageId, // From S3 upload (if successful)
  backup_backend: 'S3' or 'R2',      // Which backend was used
  ...
});
```

## Error Handling

### S3 Upload Failures
- **Non-blocking**: If S3 upload fails, the main file upload **still succeeds**
- Files are always stored in Telegram
- S3 backup is a best-effort, non-critical enhancement
- Error logged: `[BACKUP] Failed to upload chunk X to S3 backup: {reason}`

### Server Validation
```javascript
// S3Config is validated before upload
const validation = S3ConfigValidator.validate(s3Config, provider);
if (!validation.valid) {
  throw new Error(`Invalid S3 configuration: ${validation.errors.join(', ')}`);
}
```

### Validation Rules
- Bucket name: 3-63 characters, lowercase, alphanumeric + hyphens/periods
- Access credentials: non-empty strings
- Region: required for AWS S3
- Endpoint: required for R2/custom providers, must be valid URL

## File Organization in S3

Files are organized by user ID:
```
s3://my-bucket/
  {user_id}/
    {timestamp}-{original_filename}_part_1
    {timestamp}-{original_filename}_part_2
    {timestamp}-{original_filename}_part_3
    ...
```

Example:
```
s3://my-bucket/
  user-123/
    1702000000000-document.pdf_part_1
    1702000000001-document.pdf_part_2
    ...
```

## Database Schema

When a chunk is uploaded, metadata is stored:
```sql
-- file_parts table
INSERT INTO file_parts (
  file_id,
  part_number,
  telegram_file_id,      -- Unique ID from Telegram API
  backup_storage_id,     -- S3 object key (if backed up)
  backup_backend,        -- 'S3', 'R2', or NULL
  is_encrypted,
  ...
) VALUES (...)
```

## Logging

### Upload Success
```
[BACKUP] Chunk 1 uploaded to S3 (my-bucket)
[BACKUP] Chunk 2 uploaded to R2 (backup-r2)
```

### Configuration Missing
```
[BACKUP] No S3 config available (set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY env vars)
```

### Upload Failure (Non-blocking)
```
[BACKUP] Failed to upload chunk 1 to S3 backup: Access Denied
[BACKUP] Failed to upload chunk 2 to S3 backup: Bucket does not exist
```

## Security Considerations

1. **Credentials**: Only server-side has access to S3 credentials (via env vars)
2. **Encryption**: Files are encrypted before being sent to server
3. **Authentication**: All uploads require user authentication
4. **Non-blocking**: S3 failures don't expose credentials to user
5. **Validation**: All S3 configs are validated before use

## Testing S3 Connection

Use the settings modal:
1. Go to Settings → Backup
2. Fill in S3 configuration
3. Click "Test Connection"
4. Server will:
   - List available buckets
   - Verify credentials work
   - Check bucket accessibility

## Troubleshooting

### S3 upload not working but no errors in logs
- Check environment variables are set: `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- Restart the application after changing env vars
- Check logs for: `[BACKUP] No S3 config available`

### "Access Denied" errors
- Verify IAM policy allows `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- Check bucket name is correct
- Verify access key ID and secret are correct

### R2 upload not working
- Verify endpoint URL ends with `/` (e.g., `https://account-id.r2.cloudflarestorage.com/`)
- S3_REGION is ignored for R2 (set to `auto` or any value)
- Check R2 bucket exists and access key has permissions

### Connection test passes but uploads fail
- Test was with empty credentials check, actual upload needs write permissions
- Verify bucket has versioning/proper configuration
- Check CloudWatch logs for AWS S3 errors

## Future Improvements

1. Personal S3 configurations (encrypted with master password)
2. Multiple backup backends per file
3. Automatic retry logic for failed S3 uploads
4. Progress tracking for S3 uploads in UI
5. S3 to Telegram sync for disaster recovery
