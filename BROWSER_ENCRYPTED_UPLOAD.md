# Browser-Side Encrypted Upload Implementation Plan

## Executive Summary

Enable browser-side encryption for file uploads, eliminating the 100MB limit and ensuring the server never sees plaintext at any point in the lifecycle.

**Before:** Browser → Server encrypts → Telegram  
**After:** Browser encrypts → Server (already encrypted) → Telegram

**Impact:**
- ✅ Perfect end-to-end encryption
- ✅ No file size limit (unlimited)
- ✅ Server never touches plaintext
- ✅ Better security posture

---

## Architecture Overview

### Data Flow Diagram

```
UPLOAD FLOW
═══════════════════════════════════════════════════════════════

Browser:                      Server:                Telegram:
┌──────────────────┐         ┌──────────────┐       ┌─────────┐
│ 1. User selects  │         │              │       │ Storage │
│    file (10GB)   │         │              │       └─────────┘
└────────┬─────────┘         │              │
         │                   │              │
         v                   │              │
┌──────────────────┐         │              │
│ 2. Derive key    │         │              │
│    PBKDF2        │         │              │
└────────┬─────────┘         │              │
         │                   │              │
         v                   │              │
┌──────────────────┐         │              │
│ 3. Read file     │         │              │
│    streaming     │         │              │
│    (not all at   │         │              │
│    once)         │         │              │
└────────┬─────────┘         │              │
         │                   │              │
         v                   │              │
┌──────────────────────────┐ │              │
│ 4. Split into 2MB chunks │ │              │
└────────┬─────────────────┘ │              │
         │                   │              │
         v                   │              │
┌──────────────────────────┐ │              │
│ 5. For each chunk:       │ │              │
│  a) Generate random IV   │ │              │
│  b) Encrypt: AES-256-GCM │ │              │
│     (chunk, key, iv)     │ │              │
│  c) Get auth tag         │ │              │
│  d) Upload encrypted     │──────────────→│ 6. Receive
│     + iv + auth_tag      │  /api/upload/  │    encrypted
└──────────────────────────┘  chunk        │    chunk
         │                   │              │
         v                   │              │
┌──────────────────┐         │              │
│ 7. Show progress │         │              │
│    (per chunk)   │         │              │
│    100 of 500MB  │         │              │
└──────────────────┘         │              │

                             v
                      ┌──────────────┐
                      │ 8. Validate  │
                      │    encrypted │
                      │    chunk     │
                      └──────┬───────┘
                             │
                             v
                      ┌──────────────┐
                      │ 9. Save to   │
                      │    Telegram  │
                      │              │
                      │ 10. Store    │
                      │     metadata │
                      │     (iv,     │
                      │     auth_tag)│
                      └──────────────┘
                             │
                             v
                      ┌──────────────┐
                      │ 11. Return   │
                      │     success  │
                      └──────────────┘
                             ↑
                             │
                      Browser: Combine all
                      chunks in DB metadata
```

### Download Flow (Already Implemented)

```
Browser: Fetch /api/chunk → Decrypt → Display
Server: Return encrypted only (no decryption)
```

---

## Key Differences From Current System

### Current Upload (Server Encrypts)
```
1. Browser reads file (must fit in memory)
2. Browser sends plaintext to server
3. Server derives key
4. Server encrypts (AES-256-GCM)
5. Server uploads to Telegram
6. Browser gets success response

Problems:
- Server briefly has plaintext in memory
- Limited to 100MB (memory constraint)
- Server must derive key
```

### New Upload (Browser Encrypts)
```
1. Browser reads file (streaming, chunk by chunk)
2. Browser derives key
3. Browser encrypts each chunk
4. Browser uploads encrypted chunks to server
5. Server validates metadata
6. Server uploads to Telegram (already encrypted)
7. Browser gets success response

Benefits:
- Server NEVER sees plaintext
- No file size limit
- Better security
- More efficient (smaller uploads)
```

---

## Implementation Details

### 1. File Reading Strategy (Streaming)

Instead of:
```javascript
// Bad: Loads entire file into memory
const fileData = await file.arrayBuffer();
```

Use:
```javascript
// Good: Reads in chunks (streaming)
const reader = file.stream().getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process chunk (2MB)
}
```

**Benefit:** Works with unlimited file sizes, only keeps one chunk in memory.

### 2. Encryption Strategy (Per-Chunk)

```javascript
// For each 2MB chunk:
const iv = crypto.getRandomValues(new Uint8Array(12));
const encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  chunk
);
const authTag = encrypted.slice(-16); // Last 16 bytes

// Upload encrypted + iv + authTag to server
await uploadChunk({
  encrypted_data,
  iv,
  auth_tag,
  part_number,
  chunk_size
});
```

**Benefit:** Each chunk independently encrypted with unique IV. Server can verify auth tag.

### 3. Upload Strategy (Multipart)

```javascript
// Upload endpoint
POST /api/upload/chunk
{
  "file_id": "123",
  "part_number": 1,
  "total_parts": 500,
  "encrypted_data": "base64...",
  "iv": "hex...",
  "auth_tag": "hex...",
  "chunk_size": 2097152,
  "original_filename": "movie.mp4",
  "mime_type": "video/mp4"
}
```

Server response:
```json
{
  "success": true,
  "part_number": 1,
  "total_parts": 500,
  "progress": 0.2
}
```

### 4. Progress Tracking

```javascript
// Show encryption + upload progress
const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
let uploadedChunks = 0;

for (let i = 0; i < totalChunks; i++) {
  // Encrypt chunk
  const encrypted = encryptChunk(chunk, key, iv);
  
  // Upload encrypted chunk
  await uploadChunk(encrypted);
  
  uploadedChunks++;
  const progress = (uploadedChunks / totalChunks) * 100;
  setProgress(progress); // UI shows: 150 of 500 chunks (30%)
}
```

---

## Files to Create/Modify

### New Files (2)

#### 1. `lib/browserUploadEncryption.js` (200 lines)
Browser-side encryption for uploads.

Exports:
```javascript
export async function encryptFileChunks(
  file,
  password,
  onProgress,
  folderId
)
// Encrypts file in browser, yields encrypted chunks
// Shows encryption progress
// Returns: file_id, parts metadata

export async function encryptChunk(
  chunk,
  key,
  iv
)
// Encrypt single 2MB chunk
// Returns: {encrypted_data, iv, auth_tag}

export async function deriveUploadKey(password)
// PBKDF2 key derivation (same as download)

export async function uploadEncryptedChunk(
  fileId,
  partNumber,
  totalParts,
  encryptedData,
  iv,
  authTag,
  chunkSize,
  filename,
  mimeType,
  folderId,
  onProgress
)
// Upload encrypted chunk to server
// Returns: {success, part_number, progress}
```

#### 2. `app/api/upload/chunk/route.js` (100 lines)
Receive and store encrypted chunks.

Endpoint:
```
POST /api/upload/chunk
```

Request:
```json
{
  "file_id": "uuid",
  "part_number": 1,
  "total_parts": 500,
  "encrypted_data": "base64...",
  "iv": "hex...",
  "auth_tag": "hex...",
  "chunk_size": 2097152,
  "original_filename": "movie.mp4",
  "mime_type": "video/mp4",
  "folder_id": "optional-folder-id"
}
```

Response:
```json
{
  "success": true,
  "file_id": "uuid",
  "part_number": 1,
  "total_parts": 500
}
```

**Server Logic:**
1. Authenticate user
2. Validate encrypted chunk (IV, auth_tag present)
3. Save file metadata (if first chunk)
4. Upload encrypted chunk to Telegram
5. Store chunk metadata (part_number, size, iv, auth_tag)
6. Return progress
7. **NEVER decrypt** ✅

### Modified Files (1)

#### `app/components/UploadForm.jsx` (150 lines changed)

**Current Flow:**
```javascript
// 1. Read file
const file = await uploadFile.arrayBuffer();

// 2. Send plaintext to server
const res = await fetch('/api/upload', {
  method: 'POST',
  body: formData // Contains plaintext file
});

// 3. Server encrypts and uploads
```

**New Flow:**
```javascript
// 1. User enters password (if file should be encrypted)
const password = await promptPassword();

// 2. Browser encrypts file
const { file_id, progress } = await encryptFileChunks(
  uploadFile,
  password,
  (chunkNum, totalChunks) => {
    setProgress(`Encrypting: ${chunkNum}/${totalChunks}`);
  },
  folderId
);

// 3. Return success
setSuccess(`File uploaded encrypted: ${progress.uploaded}/${progress.total} chunks`);
```

---

## Database Changes

### Minimal - No Schema Changes

Just use existing tables:

```sql
files table:
  id, original_filename, file_size, mime_type, is_encrypted, ...
  (no changes)

file_parts table:
  id, file_id, telegram_file_id, part_number, size, iv, auth_tag
  (no changes - already supports this)
```

---

## Security Properties

### Before (Server Encrypts)
```
Plaintext file
    ↓ (sent over HTTPS)
Server receives plaintext
    ↓
Server encrypts
    ↓ (in memory)
Server uploads encrypted to Telegram
    ↓
Server deletes plaintext from memory
```

**Risk:** Server briefly has plaintext in memory

### After (Browser Encrypts)
```
Plaintext file (in browser only)
    ↓
Browser encrypts locally
    ↓
Encrypted chunks sent to server
    ↓
Server NEVER decrypts
    ↓
Server uploads to Telegram
```

**Benefit:** Server NEVER has plaintext ✅

### Threat Analysis

| Threat | Before | After | Notes |
|--------|--------|-------|-------|
| Server compromise | ❌ Plaintext stolen | ✅ Only encrypted | File safe |
| Network intercept | ⚠️ HTTPS required | ✓ HTTPS + encrypted | Double encrypted |
| Memory dump | ❌ Plaintext visible | ✅ Not on server | Safe |
| Server admin | ❌ Can see plaintext | ✅ Cannot decrypt | Zero-knowledge |
| Password guessing | ✗ Both | ✗ Both | Equal |

---

## Performance Characteristics

### File Sizes

| Size | Chunks | Encrypt Time | Upload Time | Total | Notes |
|------|--------|--------------|-------------|-------|-------|
| 5MB | 3 | 150ms | 1s | 1.2s | Fast |
| 50MB | 25 | 1.5s | 10s | 11.5s | Good |
| 500MB | 250 | 15s | 100s | 115s | Acceptable |
| 5GB | 2500 | 150s | 1000s | 1150s | Shows progress |

### Optimization Options

**Parallel Encryption:**
```javascript
// Encrypt ahead while uploading
const encryptPromises = [];
for (let i = 0; i < totalChunks; i++) {
  if (i < currentUploading + 3) { // Keep 3 ahead
    encryptPromises.push(encryptChunk(chunks[i]));
  }
}
```

**Web Worker:**
```javascript
// Move encryption to background thread
const worker = new Worker('/crypto-worker.js');
worker.postMessage({ chunk, key, iv });
worker.onmessage = (e) => uploadChunk(e.data);
```

---

## Implementation Steps

### Phase 1: Core Encryption Upload (4-5 hours)

1. **Create `lib/browserUploadEncryption.js`**
   - Implement `encryptFileChunks()` with streaming
   - Implement chunk encryption
   - Implement `uploadEncryptedChunk()`
   - Add progress callbacks

2. **Create `/api/upload/chunk/route.js`**
   - Receive encrypted chunks
   - Validate IV & auth_tag
   - Save to Telegram
   - Store metadata
   - NO decryption ✅

3. **Update `UploadForm.jsx`**
   - Add password prompt (if encrypting)
   - Call `encryptFileChunks()`
   - Show progress per chunk
   - Handle errors

4. **Test**
   - Upload small file (1MB)
   - Upload medium file (50MB)
   - Upload large file (500MB+)
   - Verify encrypted in DevTools
   - Verify can decrypt & preview

### Phase 2: Polish & Optimization (2-3 hours)

1. Resume failed uploads
2. Cancel upload support
3. Parallel encryption
4. Web Worker for encryption
5. Progress bar improvements
6. Error recovery

### Phase 3: Documentation (1-2 hours)

1. Update README
2. Create user guide
3. Document API changes
4. Add troubleshooting

---

## Testing Strategy

### Unit Tests

```javascript
// Test encryption
const key = await deriveUploadKey('password');
const chunk = new Uint8Array(2097152); // 2MB
const encrypted = await encryptChunk(chunk, key, iv);
assert(encrypted.data.length > 0);
assert(encrypted.iv.length === 24); // hex string
assert(encrypted.auth_tag.length === 32); // hex string
```

### Integration Tests

```javascript
// Test upload flow
1. Create 100MB file
2. Encrypt in browser
3. Upload chunks
4. Verify server has no plaintext
5. Preview encrypted file (decrypt)
6. Compare with original
```

### Manual Tests

| Test | File Size | Expected | Pass |
|------|-----------|----------|------|
| Small image | 5MB | < 5s total | [ ] |
| Medium video | 50MB | < 2min total | [ ] |
| Large video | 500MB | < 15min total | [ ] |
| Wrong password | any | Decrypt error | [ ] |
| Cancel upload | 50MB | Can retry | [ ] |
| Network timeout | 100MB | Can resume | [ ] |

---

## Browser Compatibility

| Browser | Web Crypto | Streams API | Support |
|---------|-----------|-------------|---------|
| Chrome 75+ | ✅ | ✅ | Full |
| Firefox 57+ | ✅ | ✅ | Full |
| Safari 14+ | ✅ | ✅ | Full |
| Edge 79+ | ✅ | ✅ | Full |
| IE 11 | ❌ | ❌ | No |

---

## Configuration

### Remove 100MB Limit

In `UploadForm.jsx`:
```javascript
// OLD
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// NEW
const MAX_FILE_SIZE = 1000 * 1024 * 1024 * 1024; // 1TB (browser limit)
// or unlimited (handle per system)
```

### Add Chunk Size Setting

In `lib/browserUploadEncryption.js`:
```javascript
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB (configurable)
// Larger chunks = faster but more RAM
// Smaller chunks = slower but less RAM
```

---

## Error Handling

### Common Errors

```javascript
// Out of memory
catch (err) {
  if (err.name === 'QuotaExceededError') {
    // Browser ran out of memory
    // Break upload into smaller chunks
    CHUNK_SIZE = 1 * 1024 * 1024; // 1MB
  }
}

// Network timeout
catch (err) {
  if (err.message.includes('timeout')) {
    // Retry the chunk
    // Or resume from last successful
  }
}

// Wrong password
catch (err) {
  if (err.message.includes('decrypt')) {
    // Browser tried preview with wrong password
    // Ask user to re-enter
  }
}
```

---

## API Endpoint Specification

### POST /api/upload/chunk

**Purpose:** Receive encrypted file chunk from browser

**Authentication:** Required (JWT token or session)

**Body Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file_id | string | Yes | UUID, same for all chunks of same file |
| part_number | integer | Yes | 1-based chunk number (1, 2, 3, ...) |
| total_parts | integer | Yes | Total chunks for this file |
| encrypted_data | string (base64) | Yes | Encrypted chunk data |
| iv | string (hex) | Yes | 12-byte initialization vector |
| auth_tag | string (hex) | Yes | 16-byte authentication tag |
| chunk_size | integer | Yes | Size of decrypted chunk (usually 2MB) |
| original_filename | string | Yes | Original filename (e.g., "movie.mp4") |
| mime_type | string | Yes | MIME type (e.g., "video/mp4") |
| folder_id | string | No | Optional folder to put file in |

**Response (200 OK):**

```json
{
  "success": true,
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "part_number": 1,
  "total_parts": 500,
  "chunks_received": 1,
  "status": "uploading"
}
```

**Response (Last Chunk 201 Created):**

```json
{
  "success": true,
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "part_number": 500,
  "total_parts": 500,
  "chunks_received": 500,
  "status": "completed",
  "file": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "movie.mp4",
    "size": 1073741824,
    "is_encrypted": true
  }
}
```

**Error Cases:**

```json
// 400 Bad Request
{
  "success": false,
  "error": "Missing encrypted_data"
}

// 401 Unauthorized
{
  "success": false,
  "error": "Not authenticated"
}

// 413 Payload Too Large
{
  "success": false,
  "error": "Chunk too large (max 50MB)"
}
```

---

## Backward Compatibility

**Old Upload Endpoint Still Works:**
```javascript
// Users can still upload unencrypted
POST /api/upload
{
  "file": file_blob,
  "folder_id": "optional"
}
```

**New Encrypted Upload:**
```javascript
// OR encrypt on browser
POST /api/upload/chunk (multiple requests)
{
  "file_id": "...",
  "encrypted_data": "...",
  ...
}
```

Both exist simultaneously. Old one for unencrypted files, new one for encrypted.

---

## Deployment Checklist

- [ ] Create `lib/browserUploadEncryption.js`
- [ ] Create `/api/upload/chunk/route.js`
- [ ] Update `UploadForm.jsx`
- [ ] Update `.env` (if needed)
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Manual test with various file sizes
- [ ] Test error cases (network, timeout, etc.)
- [ ] Verify server logs show NO plaintext
- [ ] Update documentation
- [ ] Deploy to production
- [ ] Monitor error rates
- [ ] Gather user feedback

---

## Success Criteria

✅ **Upload:**
- [ ] Can upload files of any size (tested to 1GB+)
- [ ] Browser encrypts before upload
- [ ] Server never sees plaintext
- [ ] Shows progress (chunks uploaded)
- [ ] Handles interruption/resume

✅ **Download (Already Done):**
- [ ] Can decrypt and preview uploaded file
- [ ] All file types work
- [ ] Server never touches plaintext

✅ **Security:**
- [ ] Server logs show NO plaintext
- [ ] Password never sent to server
- [ ] Each chunk has unique IV
- [ ] Auth tag validation on server

✅ **Performance:**
- [ ] 5MB file: < 5 seconds
- [ ] 50MB file: < 2 minutes
- [ ] 500MB file: < 20 minutes
- [ ] Responsive UI (no blocking)

---

## Future Enhancements

**Phase 4: Advanced Features (Optional)**

- [ ] Resume interrupted uploads
- [ ] Cancel in-progress upload
- [ ] Parallel chunk encryption
- [ ] Web Worker for encryption
- [ ] Compress before encryption
- [ ] Multiple file upload
- [ ] Drag-and-drop for large files
- [ ] Upload progress visualization
- [ ] Estimated time remaining

---

## Summary

This implementation provides:

✅ **Perfect End-to-End Encryption**
- Browser encrypts → Server never decrypts

✅ **No File Size Limit**
- Streaming file reading + chunked upload

✅ **Better Security**
- Server never has plaintext
- Zero-knowledge system

✅ **Compatible**
- Old unencrypted upload still works
- New encrypted upload as option

✅ **Well-Documented**
- Clear API contracts
- Comprehensive error handling
- User-friendly progress

---

**Estimated Total Time: 6-8 hours**

Ready to implement?
