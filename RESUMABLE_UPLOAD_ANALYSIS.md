# Resumable Upload Support - Comprehensive Analysis

## Executive Summary

This document provides a detailed analysis of how to implement resumable upload functionality in the Telegram File Management system. When a user interrupts a file upload and retries uploading the same file, the system should:

1. **Detect** that the file has been previously uploaded (partially or fully)
2. **Identify** which chunks are missing
3. **Resume** from where it left off instead of starting from chunk 1
4. **Deduplicate** work and avoid re-uploading existing chunks

---

## Current Architecture Overview

### Upload Flow

```
Browser (Client)
├── File Selection
├── Encryption (lib/browserUploadEncryption.js)
│   ├── Generate random DEK (Data Encryption Key)
│   ├── Wrap DEK with master password
│   ├── Pre-calculate chunk sizes (2-3MB random)
│   └── Stream file into chunks
├── Chunk Upload Loop
│   ├── Compress (optional, for text files)
│   ├── Encrypt with AES-256-GCM
│   ├── Upload to API
│   └── Send metadata (IV, auth_tag)
└── File Finalization (after last chunk)

API Server (app/api/upload/chunk/route.js)
├── Validate auth
├── Receive encrypted chunk
├── Upload to storage (TelegramStorageProvider)
├── Save metadata (fileService.handleUploadChunk)
│   ├── Create/update file record (files table)
│   ├── Save chunk metadata (file_parts table)
│   └── Track with bot assignment
└── Return success/error

Database Schema
├── files
│   ├── id (UUID, generated at client)
│   ├── user_id
│   ├── original_filename
│   ├── file_size (estimated: chunk_size × total_parts)
│   ├── is_encrypted
│   ├── encryption_algo
│   ├── encrypted_file_key (wrapped DEK)
│   ├── key_iv
│   └── encryption_version
└── file_parts
    ├── id (UUID)
    ├── file_id (FK → files.id)
    ├── telegram_file_id (storage reference)
    ├── part_number (1, 2, 3, ...)
    ├── size (original uncompressed chunk size)
    ├── iv (encryption IV)
    ├── auth_tag (GCM authentication tag)
    ├── is_compressed
    └── bot_id (which bot stored this chunk)
```

### Key Observations

1. **File ID is generated at client** (`generateFileId()` → UUID)
2. **No resume tracking** exists currently
3. **Chunks are immutable** once encrypted (same IV + data = same ciphertext only if we don't re-encrypt)
4. **Part numbers are sequential** but file metadata is created on part 1
5. **No deduplication** mechanism for partially uploaded files

---

## Resume Upload Requirements

### Problem Statement

**Scenario**: User uploads `large-video.mp4` (500MB, 167 chunks). After 50 chunks:
- Network disconnects
- User browser crashes  
- Upload is interrupted

**Current Behavior**:
- User clicks "upload large-video.mp4" again
- Browser generates a **NEW file_id** (different UUID)
- **ALL 167 chunks are re-encrypted and re-uploaded** (even the 50 that succeeded)
- Storage has duplicate chunks
- Database has orphaned records

**Desired Behavior**:
- User clicks "upload large-video.mp4" again
- System detects this is a retry of a previous upload
- System identifies chunks 1-50 exist in storage
- System only encrypts and uploads chunks 51-167
- User sees resume progress from ~30% instead of 0%

---

## Detection Strategy

### Option 1: File Hash-Based Detection (Recommended)

**Concept**: Use file's content hash to identify identical files being re-uploaded

#### Implementation Approach

```javascript
// Client-side (lib/browserUploadEncryption.js)
1. Calculate SHA-256 hash of the original file (streaming)
2. Include file_hash in upload metadata
3. Server stores file_hash in files table
4. On resume: Client calculates hash, queries API for existing file with same hash
```

**Advantages**:
- Works across sessions/devices (same file = same hash)
- Detects duplicate uploads
- Works even if user deletes and re-selects file

**Disadvantages**:
- SHA-256 hashing can be slow for large files (need streaming)
- Requires additional database query per upload start

#### Hash Calculation (Streaming)

```javascript
async function calculateFileHash(file) {
  const stream = file.stream();
  const reader = stream.getReader();
  const hasher = new SHA256();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    hasher.update(value);
  }
  
  return hasher.digest('hex');
}
```

**Database Change**:
```sql
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;
CREATE INDEX idx_files_user_hash ON files(user_id, file_hash);
```

### Option 2: File Name + Size Detection

**Concept**: Use filename + file size as a simple resume key

**Advantages**:
- No hashing overhead
- Instant detection
- Good for same-device uploads

**Disadvantages**:
- User can have multiple files with same name/size
- Doesn't work across different file versions (same name, different size)
- Ambiguous when duplicates exist

**Implementation**:
```sql
-- Create unique constraint on user + filename + size
ALTER TABLE files ADD UNIQUE(user_id, original_filename, file_size);
```

### Option 3: Hybrid Approach (Recommended for MVP)

**Concept**: Use filename + size for fast initial lookup, but use file_hash for confirmation

```javascript
// Client Step 1: Fast lookup
const existing = await fetch(`/api/upload/check?filename=${name}&size=${size}&user_id=${userId}`);

// Returns array of candidates
// Client Step 2: If candidates found
if (candidates.length === 1) {
  // Unambiguous - proceed with resume
  resume_file_id = candidates[0].id;
} else if (candidates.length > 1) {
  // Ambiguous - calculate hash and confirm
  const hash = await calculateFileHash(file);
  const confirmed = candidates.find(c => c.file_hash === hash);
  resume_file_id = confirmed?.id;
}
```

---

## Implementation Strategy

### Phase 1: Minimal Viable Resume

#### 1.1 Add Resume Metadata to Database

```sql
-- Add to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_chunk_uploaded_at TIMESTAMP;

-- Add unique index for resume detection
CREATE UNIQUE INDEX idx_files_resume_key ON files(user_id, original_filename, file_size);
```

#### 1.2 New API Endpoint: Check for Resumable Upload

```
GET /api/upload/check
Query Params:
  - filename: string
  - size: number
  - user_id: string (from auth)

Response:
{
  "exists": boolean,
  "file_id": string (if exists),
  "uploaded_chunks": number[],
  "missing_chunks": number[],
  "total_chunks": number,
  "can_resume": boolean
}
```

**Implementation** (`app/api/upload/check/route.js`):
```javascript
export async function GET(request) {
  const auth = await requireAuth(request);
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');
  const size = searchParams.get('size');
  
  // Find existing file
  const existing = await fileRepository.findByUserFilenameSize(
    auth.user.id,
    filename,
    parseInt(size)
  );
  
  if (!existing) {
    return NextResponse.json({ exists: false });
  }
  
  // Get uploaded parts
  const parts = await filePartRepository.findByFileId(existing.id);
  const uploadedParts = new Set(parts.map(p => p.part_number));
  
  // Calculate missing chunks
  const totalParts = existing.total_parts; // Stored in first chunk
  const missingParts = Array.from({length: totalParts}, (_, i) => i + 1)
    .filter(n => !uploadedParts.has(n));
  
  return NextResponse.json({
    exists: true,
    file_id: existing.id,
    uploaded_chunks: Array.from(uploadedParts).sort((a, b) => a - b),
    missing_chunks: missingParts,
    total_chunks: totalParts,
    can_resume: !existing.is_complete && missingParts.length > 0
  });
}
```

#### 1.3 Update Client: Resume Detection

```javascript
// lib/browserUploadEncryption.js - modify encryptFileChunks()

export async function encryptFileChunks(
  file,
  password,
  onProgress,
  folderId,
  abortSignal = null,
  targetFileId = null,  // NEW: for resume
  resumeChunkStart = 1  // NEW: first chunk to upload
) {
  // Check for resumable upload
  if (!targetFileId) {
    const checkRes = await fetch(
      `/api/upload/check?filename=${encodeURIComponent(file.name)}&size=${file.size}`
    );
    const checkData = await checkRes.json();
    
    if (checkData.exists && checkData.can_resume) {
      targetFileId = checkData.file_id;
      resumeChunkStart = Math.min(...checkData.missing_chunks);
      console.log(`📝 Resuming upload: chunks ${resumeChunkStart}-${checkData.total_chunks}`);
    }
  }
  
  const fileId = targetFileId || generateFileId();
  
  // ... existing chunk calculation ...
  
  // Only upload chunks from resumeChunkStart onwards
  let partNumber = 0;
  while (true) {
    // ... read from stream ...
    partNumber++;
    
    if (partNumber < resumeChunkStart) {
      // Skip already-uploaded chunks
      buffer = buffer.slice(currentChunkSize);
      continue;
    }
    
    // Process upload as normal
    await processUpload(chunkData, partNumber);
  }
}
```

#### 1.4 Update Client: Resume in UploadForm

```javascript
// app/components/UploadForm.jsx

const uploadFile = useCallback(async (fileItem, password) => {
  try {
    // Check for existing upload
    const checkRes = await fetch(
      `/api/upload/check?filename=${encodeURIComponent(fileItem.file.name)}&size=${fileItem.file.size}`
    );
    const checkData = await checkRes.json();
    
    let fileId = fileItem.fileId; // Use existing ID if provided
    let resumeFrom = 1;
    
    if (checkData.exists && checkData.can_resume) {
      fileId = checkData.file_id;
      resumeFrom = Math.min(...checkData.missing_chunks);
      updateFileStatus(fileItem.id, 'resuming', 0, null, 'Resuming from chunk ' + resumeFrom);
    }
    
    await encryptFileChunks(
      fileItem.file,
      password,
      (partNumber, totalParts, stage) => {
        // Progress now accounts for resumed chunks
        const progress = (partNumber / totalParts) * 100;
        updateFileStatus(fileItem.id, 'uploading', progress, null, stage);
      },
      currentFolderId,
      abortController.signal,
      fileId,
      resumeFrom  // Pass resume starting point
    );
    
    updateFileStatus(fileItem.id, 'success', 100);
  } catch (err) {
    // ... error handling ...
  }
}, []);
```

#### 1.5 Prevent Duplicate Chunk Uploads

**Issue**: If user resumes and network hiccups, a chunk might be uploaded twice with same part_number

**Solution**: Use upsert logic in fileService

```javascript
// lib/fileService.js - handleUploadChunk()

async handleUploadChunk(userId, body) {
  const { file_id, part_number, total_parts } = body;
  
  // Check if this part already exists
  const existingPart = await filePartRepository.findByFileIdAndPart(
    file_id,
    part_number
  );
  
  if (existingPart) {
    console.log(`Part ${part_number} already exists, skipping duplicate`);
    // Return success without re-saving
    return { fileRecord: existing_file, isLastChunk: false };
  }
  
  // ... rest of logic ...
}
```

---

### Phase 2: Enhanced Resume with Better UX

#### 2.1 Resume State Persistence

Store resume state in localStorage so user can resume even after browser restart:

```javascript
// Client-side storage
const resumeKey = `upload_resume_${file_id}`;
localStorage.setItem(resumeKey, JSON.stringify({
  file_id,
  filename: file.name,
  fileSize: file.size,
  totalChunks,
  uploadedChunks: [1, 2, 3, ...],
  timestamp: Date.now(),
  password_hash: await hashPassword(password) // for validation
}));

// On page reload
const resumed = localStorage.getItem(resumeKey);
if (resumed) {
  // Offer "Resume upload of X" button
}

// On completion
localStorage.removeItem(resumeKey);
```

#### 2.2 Resume Cleanup

Implement cleanup for stale uploads (>7 days):

```javascript
// API: DELETE /api/upload/resume/{file_id}
// Cleanup DB records and storage for abandoned uploads
```

#### 2.3 Resume Progress UI

```jsx
{item.status === 'resuming' && (
  <div className="bg-amber-50 border border-amber-200 rounded p-3 mb-3">
    <p className="text-sm font-medium text-amber-900">
      Resuming from chunk {resumeChunkStart}/{totalChunks}
    </p>
    <div className="w-full bg-amber-100 rounded-full h-2 mt-2">
      <div 
        style={{ width: `${(resumeChunkStart / totalChunks) * 100}%` }}
        className="bg-amber-500 h-2 rounded-full"
      />
    </div>
  </div>
)}
```

---

### Phase 3: Advanced Features

#### 3.1 File Hash Verification

```javascript
// Verify resumed file matches original
async function verifyFileHash(file, existingHash) {
  const newHash = await calculateFileHash(file);
  if (newHash !== existingHash) {
    throw new Error('File has changed - cannot resume');
  }
}
```

#### 3.2 Chunk Integrity Verification

Before resuming, verify that existing chunks are valid:

```javascript
// POST /api/upload/verify-chunks
// Input: file_id, chunk_numbers
// Returns: {valid_chunks, corrupted_chunks, needs_re_upload}

async function verifyChunks(fileId, chunkNumbers) {
  const parts = await filePartRepository.findByFileId(fileId);
  
  for (const chunkNum of chunkNumbers) {
    const part = parts.find(p => p.part_number === chunkNum);
    if (!part) continue;
    
    // Download chunk and verify auth_tag
    const chunk = await storageProvider.getChunk(part.telegram_file_id);
    const isValid = await verifyAuthTag(chunk, part.auth_tag);
    
    if (!isValid) {
      // Mark for re-upload
    }
  }
}
```

#### 3.3 Parallel Resume Upload

Allow resuming chunks in parallel (already implemented, just ensure it works with resume):

```javascript
// Current: MAX_CONCURRENT_CHUNKS = 3
// This automatically handles resumed uploads
```

---

## Database Schema Changes Required

### Migration Script

```sql
-- Migration: Add resumable upload support
-- Date: 2024-12-21

-- Add resume tracking to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS last_chunk_uploaded_at TIMESTAMP;
ALTER TABLE files ADD COLUMN IF NOT EXISTS total_parts_expected INTEGER;
ALTER TABLE files ADD COLUMN IF NOT EXISTS encrypted_file_key TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS key_iv TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1;

-- Create index for fast resume detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_resume_key 
ON files(user_id, original_filename, file_size) 
WHERE is_complete = false;

-- Create index for file hash lookup
CREATE INDEX IF NOT EXISTS idx_files_user_hash ON files(user_id, file_hash);

-- Add composite index for resume queries
CREATE INDEX IF NOT EXISTS idx_files_resume_lookup 
ON files(user_id, original_filename, is_complete);

-- Create upload_sessions table for tracking in-progress uploads
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  total_parts INTEGER NOT NULL,
  uploaded_parts INTEGER DEFAULT 0,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, abandoned
  password_hash TEXT, -- For validation on resume
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP, -- Auto-cleanup after 7 days
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);

-- Add trigger to track last activity
CREATE TRIGGER IF NOT EXISTS tr_upload_sessions_update_activity
AFTER INSERT OR UPDATE ON file_parts
BEGIN
  UPDATE upload_sessions 
  SET last_activity_at = CURRENT_TIMESTAMP
  WHERE file_id = NEW.file_id;
END;
```

---

## API Changes Required

### New Endpoints

#### 1. Check Resume Availability

```
GET /api/upload/check
Query: filename, size
Response: { exists, file_id, uploaded_chunks, missing_chunks, can_resume }
```

#### 2. Verify Chunks

```
POST /api/upload/verify-chunks
Body: { file_id, chunk_numbers }
Response: { valid_chunks, corrupted_chunks }
```

#### 3. Get Resume Status

```
GET /api/upload/resume/:file_id
Response: { file_id, uploaded_chunks, total_chunks, progress_percent }
```

#### 4. Cancel Resume (Cleanup)

```
DELETE /api/upload/resume/:file_id
Response: { deleted: true }
```

#### 5. Clean Abandoned Uploads

```
POST /api/upload/cleanup-abandoned
Response: { deleted_count: number, freed_storage: bytes }
```

---

## Storage Provider Considerations

### Telegram-Specific

Telegram chunks are sent as documents and assigned `file_id` by Telegram. These are immutable:
- Same encrypted data + IV = **different** Telegram file_id each time (because Telegram generates unique IDs)
- **Solution**: Store `telegram_file_id` in `file_parts.telegram_file_id` to reference the chunk

### Re-Encryption Concern

**Important**: We should **NOT** re-encrypt resumed chunks because:
1. AES-256-GCM with different random IVs = different ciphertexts for same plaintext
2. We can't verify the original encrypted data matches the plaintext
3. We'd need to re-store in Telegram (new `telegram_file_id`)

**Solution**: On resume, skip already-uploaded chunks entirely (don't re-encrypt them)

---

## Error Handling

### Network Interruption During Resume

```
Scenario: 
  - Chunks 1-50 uploaded successfully
  - User resumes
  - Network fails during chunk 75

Behavior:
  - on_progress shows: "Uploading chunk 75/167..."
  - On reconnect, user clicks "Resume" again
  - System detects chunks 1-74 exist
  - Continues from chunk 75
```

### Corrupted Chunk Detection

```
Scenario:
  - Chunk 30 stored in Telegram but auth_tag is corrupt
  - User resumes

Behavior:
  - Verify chunks API detects corruption
  - Marks chunk 30 for re-upload
  - User is prompted to re-upload that chunk
```

### File Modified During Resume

```
Scenario:
  - User starts uploading file
  - File gets modified (new content)
  - User resumes

Behavior:
  - File hash changes
  - System detects mismatch
  - Offers: (a) start fresh, (b) cancel
```

---

## Implementation Priority

### MVP (Minimal Viable Product)
1. ✅ Add file_hash and is_complete to files table
2. ✅ Implement `/api/upload/check` endpoint
3. ✅ Update `encryptFileChunks()` to accept `resumeChunkStart`
4. ✅ Update `UploadForm` to detect and resume
5. ✅ Prevent duplicate chunk uploads in `fileService`

### Phase 2 (Enhanced UX)
1. Resume state in localStorage
2. Resume progress UI indicators
3. Abandoned upload cleanup (cron job)

### Phase 3 (Robustness)
1. Chunk verification on resume
2. File hash validation
3. Corrupted chunk re-upload
4. Upload session tracking

---

## Testing Strategy

### Unit Tests

```javascript
// Test: Resume detection
test('detects resumable upload when file exists with missing chunks', async () => {
  // Create partial upload
  // Query /api/upload/check
  // Assert: can_resume = true, missing_chunks = [51-100]
});

// Test: Skip duplicate chunks
test('skips re-uploading already-stored chunks', async () => {
  // Create partial upload
  // Resume upload
  // Assert: only chunks 51-100 are uploaded
});
```

### Integration Tests

```javascript
// Test: Full resume cycle
test('user can interrupt and resume large file upload', async () => {
  const file = createTestFile(500 * 1024 * 1024); // 500MB
  
  // Step 1: Start upload, stop after 50 chunks
  uploadChunks(file, 1, 50);
  
  // Step 2: Resume
  const checkRes = await fetch('/api/upload/check?...');
  assert(checkRes.can_resume === true);
  
  uploadChunks(file, 51, 167);
  
  // Step 3: Verify file is complete
  const fileRecord = await getFile(file_id);
  assert(fileRecord.is_complete === true);
});
```

### Manual Testing

1. **Large file (>500MB)**: Upload, stop after 50%, resume
2. **Network simulation**: Use browser DevTools to throttle/fail requests
3. **Multiple resumes**: Start upload, pause, resume, pause, resume
4. **Different files with same name**: Upload twice with different content
5. **Browser restart**: Close tab/browser during upload, reopen, resume

---

## Performance Considerations

### Client-Side

- **File hashing**: SHA-256 on 500MB file takes ~2-3 seconds
  - Solution: Optional (use filename+size as primary key)
  - UI: Show "Checking for previous upload..." spinner

- **Resume check API**: Add database index on (user_id, filename, file_size)
  - Impact: Adds 1-2ms per upload start

### Server-Side

- **Resume lookup query**: Should be fast (<10ms) with proper indexes
  - `CREATE UNIQUE INDEX idx_files_resume_key ON files(user_id, original_filename, file_size)`

- **Chunk verification**: Only if user explicitly requests it
  - Don't do automatic verification on resume to keep it fast

### Storage

- **Telegram**: No impact (chunks already stored)
- **Database**: Small increase in rows (one entry per chunk part)
  - Current: 1 row per chunk
  - After: Same (no change)

---

## Security Implications

### Encryption Keys

- **Resume same encryption key?** 
  - YES: Same file_id, same DEK (derived key), same password
  - The client has the password, so encryption key derivation is deterministic
  
- **Key management**:
  - Don't change keys during resume
  - Same wrapped key stored in file record
  - Chunk IVs are unique per chunk (already random)

### Authentication

- Resume should only work if:
  1. User is authenticated
  2. User owns the file_id
  3. Password is correct (if encryption enabled)

```javascript
// Validate resume attempt
if (user.id !== file.user_id) {
  throw new Error('Unauthorized');
}
```

### Privacy

- Resumable uploads don't introduce new privacy risks
- File hashes are user-owned and never transmitted externally
- Chunk storage is encrypted end-to-end (no change)

---

## Deployment Checklist

- [ ] Database migration scripts tested
- [ ] New API endpoints documented
- [ ] Client code tested with network interruption
- [ ] Resume state cleanup mechanism (cron job)
- [ ] Monitoring/logging for resume events
- [ ] Documentation updated (users & developers)
- [ ] Backward compatibility verified (old uploads still work)

---

## Edge Cases & Gotchas

| Scenario | Behavior | Status |
|----------|----------|--------|
| User uploads file A, deletes it, uploads file A again with same name/size | Resume offered, user can confirm | ⚠️ Requires confirmation |
| User uploads file, loses internet, retries 3x | Only 1 resume state, retries merge | ✅ Handled |
| File modified between upload attempts | Hash mismatch, prompt user | ⚠️ Phase 3 |
| Upload completed but finalization fails | is_complete=false, can resume | ✅ Handled |
| Part corruption in storage | Part marked invalid, re-upload | ⚠️ Phase 3 |
| User cancels resume mid-way | Partial chunks stored, can resume again | ✅ Handled |
| Concurrent uploads of same file | Race condition, needs locking | ⚠️ Edge case |

---

## Migration Path for Existing Uploads

For files already uploaded without resume support:

```javascript
// Data migration NOT needed
// Old files can't be resumed (no file_id matching)
// New uploads use new resume system
// Both systems coexist
```

---

## Summary of Changes

| Component | Change | Complexity |
|-----------|--------|-----------|
| Database | +3 columns, +4 indexes, +1 new table | Low |
| Client (UploadForm) | Detect resume, pass file_id to encryptFileChunks | Medium |
| Client (browserUploadEncryption) | Accept resumeChunkStart, skip chunks before it | Low |
| API | 5 new endpoints | Medium |
| FileService | Check for duplicate parts on upload | Low |
| UI | Resume progress indicator, resume button | Medium |

**Total Effort**: ~40-60 hours for full implementation (Phases 1-3)
**MVP Only**: ~20-30 hours

