# Two-Layer S3 Encryption - Developer Reference

Quick reference for developers working with personal S3 credentials.

## API Reference

### GET `/api/encryption/public-key`
Returns server's RSA-4096 public key for client-side credential re-encryption.

**Auth:** Not required  
**Response:**
```json
{
  "public_key": "-----BEGIN PUBLIC KEY-----\nMIIC...\n-----END PUBLIC KEY-----",
  "algorithm": "RSA-4096",
  "padding": "OAEP-SHA256"
}
```

### GET `/api/upload/s3-config`
Returns user's encrypted S3 config (encrypted with Master Password).

**Auth:** Required (user must be logged in)  
**Response:**
```json
{
  "hasConfig": true,
  "config": {
    "encrypted_data": "base64...",
    "iv": "hex...",
    "auth_tag": "hex..."
  }
}
```

### POST `/api/upload/chunk`
Upload encrypted file chunk. First chunk can include re-encrypted S3 config.

**Auth:** Required  
**Body:**
```json
{
  "file_id": "uuid",
  "part_number": 1,
  "total_parts": 5,
  "encrypted_data": "base64...",
  "iv": "hex...",
  "auth_tag": "hex...",
  "chunk_size": 3145728,
  "original_filename": "document.pdf",
  "s3_config_reencrypted": {
    "encrypted_data": "base64..."
  }
}
```

The `s3_config_reencrypted` is only sent on first chunk and cached by server.

### GET `/api/chunk/[fileId]/[partNumber]`
Download encrypted file chunk with optional S3 fallback config.

**Auth:** Required or valid share token  
**Headers:**
```http
X-S3-Config: {"encrypted_data":"base64..."}
```

Server uses header to decrypt S3 config if Telegram fails.

## Module Reference

### `lib/encryption/rsaKeyManager.js`

```javascript
import { rsaKeyManager } from '@/lib/encryption/rsaKeyManager';

// Initialize keys (auto-generates if missing)
await rsaKeyManager.init();

// Encrypt with public key
const encrypted = rsaKeyManager.encryptWithPublic(plaintext);

// Decrypt with private key
const plaintext = rsaKeyManager.decryptWithPrivate(encryptedBase64);

// Get public key for API response
const publicKey = rsaKeyManager.getPublicKey();
```

### `lib/browserS3ConfigEncryption.js`

```javascript
import {
  getServerPublicKey,
  encryptS3ConfigWithServerKey,
  decryptS3ConfigWithMasterPassword
} from '@/lib/browserS3ConfigEncryption';

// Get server's public key
const pubKey = await getServerPublicKey();

// Re-encrypt S3 config with server key
const reencrypted = await encryptS3ConfigWithServerKey(s3Config, pubKey);

// Decrypt S3 config with master password
const s3Config = await decryptS3ConfigWithMasterPassword(
  encryptedConfig,
  masterPassword,
  salt
);
```

### `lib/secureImageCache.js`

```javascript
import { getCachedOrDecrypt, blobCache } from '@/lib/secureImageCache';

// Use deduplication for concurrent requests
const entry = await getCachedOrDecrypt(fileId, async () => {
  const blob = await fetchAndDecryptFullFile(...);
  return URL.createObjectURL(blob);
});

const url = entry.url; // Shared across all concurrent requests
```

## Data Flow Diagrams

### Upload with Personal S3

```
User selects file
    ↓
Browser: encryptFileChunks()
    ├─ Fetch /api/settings (encryption salt)
    ├─ Fetch /api/upload/s3-config (encrypted config)
    ├─ Decrypt config with Master Password
    ├─ Fetch /api/encryption/public-key (RSA pub key)
    ├─ Re-encrypt config with RSA key
    └─ Upload chunks with s3_config_reencrypted on chunk 1
        ↓
    Server: POST /api/upload/chunk
        ├─ Decrypt s3_config_reencrypted with RSA private key
        ├─ Cache decrypted config in memory (per fileId, 30 min)
        ├─ Upload chunk to Telegram (primary)
        ├─ Upload chunk to S3 (backup, using cached config)
        └─ Discard credentials from memory
```

### Download with S3 Fallback

```
User opens file
    ↓
Browser: Lightbox.loadContent()
    ├─ Fetch /api/files/{fileId}/parts (part metadata)
    ├─ Call getCachedOrDecrypt() → deduplicates concurrent requests
    ├─ fetchAndDecryptFullFile() calls:
    │   ├─ Fetch /api/settings (encryption salt) [cached 5 min]
    │   ├─ Fetch /api/upload/s3-config [cached 5 min]
    │   ├─ Decrypt S3 config with Master Password [cached 5 min]
    │   ├─ Fetch /api/encryption/public-key [cached 5 min]
    │   ├─ Re-encrypt with RSA key [done once, passed to all chunks]
    │   └─ For each chunk:
    │       └─ fetchAndDecryptChunk()
    │           ├─ Try: GET /api/chunk/{fileId}/{partNumber}
    │           │   └─ Server fetches from Telegram
    │           └─ On failure:
    │               ├─ Use X-S3-Config header to send re-encrypted config
    │               ├─ Server decrypts and tries S3 fallback
    │               └─ Download chunk from S3
    └─ Decrypt all chunks locally with DEK
        ↓
    Create blob URL and display
```

## Security Checklist

- [ ] RSA private key stored in `./.keys/rsa.key` (never committed)
- [ ] Master Password only used in browser (never sent to server)
- [ ] S3 credentials decrypted in server memory only (during active use)
- [ ] S3 credentials immediately discarded after chunk upload/download
- [ ] Re-encrypted S3 config sent only on first chunk (cached on server)
- [ ] X-S3-Config header accepted for S3 fallback downloads
- [ ] No logging of plain-text credentials anywhere
- [ ] RSA keys auto-initialized on first startup (idempotent)

## Common Patterns

### Initialize RSA Keys in API Handler

```javascript
import { rsaKeyManager } from '@/lib/encryption/rsaKeyManager';

export async function GET(request) {
  // Ensure keys are initialized
  if (!rsaKeyManager.publicKey) {
    await rsaKeyManager.init();
  }
  
  const publicKey = rsaKeyManager.getPublicKey();
  return NextResponse.json({ public_key: publicKey });
}
```

### Cache S3 Config per Upload

```javascript
const s3ConfigCache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

const cacheKey = `${userId}:${fileId}`;
const cached = s3ConfigCache.get(cacheKey);

if (cached && cached.expiresAt > Date.now()) {
  s3Config = cached.s3Config;
} else {
  // Decrypt S3 config once, cache it
  s3Config = rsaKeyManager.decryptWithPrivate(body.s3_config_reencrypted.encrypted_data);
  s3ConfigCache.set(cacheKey, {
    s3Config,
    expiresAt: Date.now() + CACHE_TTL
  });
}
```

### Deduplicate Concurrent Requests

```javascript
import { getCachedOrDecrypt } from '@/lib/secureImageCache';

// Multiple components call this simultaneously
const entry = await getCachedOrDecrypt(fileId, async () => {
  // Expensive decryption operation
  const blob = await expensiveDecryption();
  return URL.createObjectURL(blob);
});

// All concurrent callers get the same promise/result
return entry.url;
```

## Debugging Tips

### Check RSA Keys Exist
```bash
ls -la ./.keys/
# Should show rsa.key and rsa.pub
```

### Verify S3 Config Cache
```javascript
// In upload chunk handler
console.log('S3 Config Cache:', {
  size: s3ConfigCache.size,
  keys: Array.from(s3ConfigCache.keys())
});
```

### Monitor Blob Cache
```javascript
// In component
import { blobCache } from '@/lib/secureImageCache';

console.log('Blob Cache:', {
  size: blobCache.size,
  entries: Array.from(blobCache.entries()).map(([id, entry]) => ({
    fileId: id,
    url: entry.url.substring(0, 50) + '...',
    age: Date.now() - entry.timestamp
  }))
});
```

### Trace S3 Config Flow
Enable logging in:
- `lib/browserS3ConfigEncryption.js` - browser encryption
- `app/api/upload/chunk/route.js` - server decryption
- `lib/clientDecryption.js` - download preparation

Search for `[S3]` prefix in logs to trace config flow.

## Known Limitations

1. **Personal S3 Required for Instant Sharing**
   - Files uploaded before S3 feature need "Security Upgrade" to enable sharing
   - Upgrade downloads, decrypts, re-encrypts with DEK, and re-uploads

2. **Master Password Recovery**
   - If user loses Master Password, S3 credentials become inaccessible
   - User must reconfigure S3 with new Master Password

3. **RSA Key Rotation**
   - Current implementation doesn't support key rotation
   - Would require re-encrypting all stored configs

4. **Performance**
   - First S3 upload slightly slower (key derivation + encryption)
   - Subsequent chunks fast (cached config)
   - Downloads cache S3 config to avoid redundant crypto

## Related Documentation

- [Personal S3 Setup Guide](./PERSONAL_S3_SETUP_GUIDE.md) - User setup instructions
- [Architecture Overview](./S3_UPLOAD_ARCHITECTURE.md) - Detailed architecture
- [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) - Commit summary
