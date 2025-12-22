# Personal S3 Upload with Two-Layer Encryption

## Overview

Users can now configure their own S3 buckets (AWS, R2, MinIO, etc.) with complete security:
- Master password never leaves browser
- S3 credentials never persisted on server
- Two layers of encryption protect credentials in transit

## Architecture

```
┌─────────────────────────────────────────┐
│ Browser                                 │
│                                         │
│ 1. User enters S3 config in Settings    │
│ 2. Encrypts with MASTER PASSWORD        │
│ 3. Sends to server (stored encrypted)   │
└─────────────────────────────────────────┘
                      │
                      │ Database
                      │
                      ▼
┌─────────────────────────────────────────┐
│ Server (at rest)                        │
│                                         │
│ S3 config: encrypted_s3_config          │
│            iv                           │
│            auth_tag                     │
│            (all encrypted with master   │
│             password key)               │
└─────────────────────────────────────────┘


DURING UPLOAD:

Browser:
  1. Decrypts S3 config with MASTER PASSWORD
  2. Fetches server's PUBLIC KEY from /api/encryption/public-key
  3. Re-encrypts config with SERVER PUBLIC KEY
  4. Sends re-encrypted config to server (only during this upload)

Server:
  1. Receives re-encrypted config
  2. Decrypts with SERVER PRIVATE KEY
  3. Uploads chunks to user's S3 bucket
  4. DISCARDS credentials (never persists, only in memory)
  5. If upload fails, falls back to global S3 config
```

## Security Guarantees

✅ **Master Password Never on Server**
- Browser decrypts S3 config with master password
- Master password never sent to server
- Only browser has access to master password

✅ **S3 Credentials Only in Memory**
- Server decrypts re-encrypted config temporarily
- Uses credentials immediately for upload
- Discards credentials after upload (garbage collected)
- Never persisted to database or logs

✅ **Encrypted in Transit**
- Browser encrypts config with server's public key (RSA-4096)
- Even if HTTPS is compromised, config is still encrypted
- Only server (with private key) can decrypt

✅ **Defense in Depth**
- Layer 1: Master password (browser-only)
- Layer 2: Server public key (server-only private key)
- Layer 3: HTTPS transport encryption
- Layer 4: Temporary credentials only in memory

## Implementation Details

### Browser Flow

**Step 1: Decrypt with Master Password**
```javascript
const encryptedConfig = await fetch('/api/upload/s3-config');
const decrypted = await decryptS3ConfigWithMasterPassword(
  encryptedConfig,
  masterPassword,
  encryptionSalt
);
// Result: { bucket, accessKeyId, secretAccessKey, region, ... }
```

**Step 2: Get Server's Public Key**
```javascript
const publicKeyPEM = await getServerPublicKey();
// Returns: RSA-4096 public key in PEM format
```

**Step 3: Re-encrypt with Server Key**
```javascript
const reencrypted = await encryptS3ConfigWithServerKey(
  decrypted,
  publicKeyPEM
);
// Result: { encrypted_data: base64 }
```

**Step 4: Send with Upload**
```javascript
await fetch('/api/upload/chunk', {
  body: {
    encrypted_chunk: '...',
    s3_config_reencrypted: reencrypted  // Only first chunk
  }
});
```

### Server Flow

**Step 1: Receive and Decrypt**
```javascript
const { s3_config_reencrypted } = body;

if (s3_config_reencrypted) {
  const decrypted = rsaKeyManager.decryptWithPrivate(
    s3_config_reencrypted.encrypted_data
  );
  const s3Config = JSON.parse(decrypted);
}
```

**Step 2: Upload Using Credentials**
```javascript
// Use immediately
await s3Provider.uploadChunk(userId, buffer, filename, s3Config);

// After upload, s3Config variable goes out of scope
// Node.js garbage collector removes it from memory
// Never persisted anywhere
```

**Step 3: Fallback to Global S3**
```javascript
// If personal S3 fails or not provided
if (!s3Config && config.s3Bucket) {
  s3Config = { // Use global config from env vars
    bucket: config.s3Bucket,
    accessKeyId: config.s3AccessKeyId,
    secretAccessKey: config.s3SecretAccessKey,
    ...
  };
}
```

## Key Generation

**RSA Keys:**
- Generated on first app startup: `POST /api/init`
- Stored in `.keys/` directory (git-ignored)
- `rsa.pub` - Public key (shared with browser)
- `rsa.key` - Private key (never leaves server)
- 4096-bit RSA (strong encryption)

**Permissions:**
- Public key: `644` (readable by all)
- Private key: `600` (readable by owner only)
- Key directory: `700` (owner only)

## API Endpoints

### GET /api/encryption/public-key
Returns server's RSA public key for browser.
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----",
  "algorithm": "RSA-4096",
  "padding": "OAEP-SHA256"
}
```

### GET /api/upload/s3-config
Returns user's S3 config encrypted with master password.
**Requires authentication.**
```json
{
  "hasConfig": true,
  "config": {
    "encrypted_data": "hex...",
    "iv": "hex...",
    "auth_tag": "hex..."
  }
}
```

### POST /api/upload/chunk
Upload encrypted file chunk.
Accepts optional `s3_config_reencrypted` for personal S3.
**Only on first chunk.**

## Configuration Priority

1. **Personal S3** (user configured, browser-decrypted-and-reencrypted)
   - User sets in Settings → Backup
   - Encrypted with master password in database
   - Browser decrypts and re-encrypts for upload
   - ✅ Uses user's own S3 bucket

2. **Global S3** (admin configured, environment variables)
   - Admin sets via env vars
   - Not encrypted (stored as plain env vars)
   - All users share bucket
   - ✅ Fallback option

If personal S3 fails: automatically falls back to global S3.

## File Organization in S3

Files organized by user ID:
```
bucket/
  {user_id}/
    1702000000000-document.pdf_part_1
    1702000000000-document.pdf_part_2
    ...
```

Files are encrypted end-to-end (from browser), so even if S3 is compromised, files are secure.

## Logging

**Secure:**
```
[BACKUP] Using personal S3 config (bucket: my-bucket)
[BACKUP] Using global S3 config (bucket: org-backup)
[BACKUP] Chunk 1 uploaded to S3 (Personal)
```

**Never logged:**
- S3 credentials
- Access keys
- Secret keys
- Config values (only bucket name for clarity)

## Error Handling

**Personal S3 Decryption Fails:**
```
[BACKUP] Failed to decrypt personal S3 config: Invalid RSA format
→ Falls back to global S3 (if configured)
```

**Personal S3 Upload Fails:**
```
[BACKUP] Failed to upload chunk 1 to S3 backup: Access Denied
→ Still succeeds in Telegram (primary storage)
→ Falls back to global S3 (if configured)
```

**No Config Available:**
```
[BACKUP] No S3 config available
→ File still uploads to Telegram (primary storage)
→ Non-blocking, doesn't affect main upload
```

## User Experience

### Setup (One-time)
1. Settings → Backup
2. Configure Backup Storage
3. Choose S3 provider (S3 / R2 / Custom)
4. Enter bucket name, access key, secret key
5. Test connection
6. Save

### Upload (Automatic)
1. User selects file
2. File is encrypted on browser
3. Browser automatically:
   - Decrypts personal S3 config (with master password)
   - Re-encrypts with server key
   - Sends to server
4. Server automatically:
   - Decrypts with private key
   - Uploads chunks to user's S3 bucket
   - Falls back if needed
5. User sees single upload progress (doesn't see S3 details)

### Download (Automatic Fallback)
1. Request file chunk
2. Server tries Telegram first (primary)
3. If not found, tries personal S3 (from metadata)
4. If not found, tries global S3
5. Returns to browser (still encrypted)
6. Browser decrypts with master password

## Future Improvements

- [ ] Support for organization-level S3 configs
- [ ] S3 bucket versioning and recovery
- [ ] Progress tracking for S3 uploads in UI
- [ ] Automatic retry logic for failed S3 uploads
- [ ] S3 to Telegram sync for disaster recovery
- [ ] Custom S3 endpoint configuration in UI
- [ ] S3 storage class selection in UI
- [ ] Cost estimation for S3 usage

## Troubleshooting

### "Failed to decrypt personal S3 config"
- Ensure master password is correct
- Check that S3 config was saved properly
- Try re-configuring S3 in Settings

### "Access Denied" on S3 upload
- Verify AWS/R2 credentials are correct
- Check bucket exists
- Verify IAM policy allows `s3:PutObject`
- Check bucket permissions

### Uploads work but S3 backup not happening
- Check logs for `[BACKUP]` messages
- Ensure S3 config is saved in Settings
- Verify network connectivity to S3
- Check firewall allows outbound to S3

### Key files not found
- Check `.keys/` directory exists
- Check permissions: `rsa.key` should be `600`, `rsa.pub` should be `644`
- Keys regenerate on first request (automatic)

## Testing

```javascript
// Simulate user S3 config upload to Settings
const s3Config = {
  bucket: 'my-bucket',
  accessKeyId: 'AKIA...',
  secretAccessKey: '...',
  region: 'us-east-1'
};
const encrypted = await encryptWithMasterPassword(s3Config, password, salt);
// Save to database

// Simulate file upload
const file = new File(['test'], 'file.txt');
await encryptFileChunks(file, password, ...);
// Browser will automatically:
// 1. Fetch encrypted config
// 2. Decrypt with password
// 3. Re-encrypt with server key
// 4. Send to server
// 5. Server decrypts and uploads to S3
```
