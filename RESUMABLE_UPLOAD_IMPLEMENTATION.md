# Resumable Upload - Implementation Guide

## Quick Start (MVP Implementation - ~20 hours)

This guide provides step-by-step instructions to implement Phase 1 resumable uploads.

---

## Step 1: Database Migration (1 hour)

### 1.1 Create Migration File

```bash
touch db/migrations/003_add_resumable_upload_support.sql
```

### 1.2 Migration SQL

```sql
-- db/migrations/003_add_resumable_upload_support.sql

-- Add resume tracking columns to files table
ALTER TABLE files ADD COLUMN IF NOT EXISTS file_hash TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS total_parts_expected INTEGER;

-- Create indexes for fast resume detection
CREATE UNIQUE INDEX IF NOT EXISTS idx_files_resume_key 
ON files(user_id, original_filename, file_size) 
WHERE is_complete = false;

CREATE INDEX IF NOT EXISTS idx_files_user_hash ON files(user_id, file_hash);

-- Create upload_sessions table for tracking
CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  file_id TEXT NOT NULL,
  uploaded_parts INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_user ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_expires ON upload_sessions(expires_at);
```

### 1.3 Run Migration

```bash
# Update lib/db.js to run this migration on startup, or manually:
sqlite3 db/files.db < db/migrations/003_add_resumable_upload_support.sql
```

---

## Step 2: Add Repository Method (1 hour)

### 2.1 Update FileRepository

```javascript
// lib/repositories/FileRepository.js

async findByUserFilenameSize(userId, filename, size) {
  try {
    const result = await this.pool.query(
      `SELECT * FROM files 
       WHERE user_id = $1 
       AND original_filename = $2 
       AND file_size = $3
       AND is_complete = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, filename, size]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error finding resumable file:', err);
    return null;
  }
}

async markComplete(fileId) {
  try {
    await this.pool.query(
      `UPDATE files SET is_complete = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [fileId]
    );
  } catch (err) {
    console.error('Error marking file complete:', err);
    throw err;
  }
}
```

### 2.2 Update FilePartRepository

```javascript
// lib/repositories/FilePartRepository.js

async findByFileIdAndPart(fileId, partNumber) {
  try {
    const result = await this.pool.query(
      `SELECT * FROM file_parts 
       WHERE file_id = $1 AND part_number = $2`,
      [fileId, partNumber]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Error finding file part:', err);
    return null;
  }
}

async getUploadedPartNumbers(fileId) {
  try {
    const result = await this.pool.query(
      `SELECT part_number FROM file_parts 
       WHERE file_id = $1 
       ORDER BY part_number ASC`,
      [fileId]
    );
    return result.rows.map(r => r.part_number);
  } catch (err) {
    console.error('Error getting uploaded parts:', err);
    return [];
  }
}
```

---

## Step 3: Create Resume Check API Endpoint (2 hours)

### 3.1 Create Endpoint

```javascript
// app/api/upload/check/route.js

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fileRepository } from '@/lib/repositories/FileRepository';
import { filePartRepository } from '@/lib/repositories/FilePartRepository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/check
 * 
 * Check if file can be resumed
 * Query params: filename, size
 * 
 * Response: {
 *   exists: boolean,
 *   file_id: string (if exists),
 *   uploaded_chunks: number[],
 *   missing_chunks: number[],
 *   total_chunks: number,
 *   can_resume: boolean
 * }
 */
export async function GET(request) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const size = parseInt(searchParams.get('size'), 10);

    // Validate params
    if (!filename || !size) {
      return NextResponse.json(
        { error: 'Missing filename or size' },
        { status: 400 }
      );
    }

    // Find existing incomplete upload
    const existingFile = await fileRepository.findByUserFilenameSize(
      userId,
      filename,
      size
    );

    if (!existingFile) {
      return NextResponse.json({
        exists: false,
        can_resume: false
      });
    }

    // Get uploaded parts
    const uploadedParts = await filePartRepository.getUploadedPartNumbers(
      existingFile.id
    );

    // Calculate missing chunks
    const totalChunks = existingFile.total_parts_expected || 0;
    
    if (totalChunks === 0) {
      // If total_parts not known yet, can't resume
      return NextResponse.json({
        exists: false,
        can_resume: false
      });
    }

    const uploadedSet = new Set(uploadedParts);
    const missingChunks = Array.from(
      { length: totalChunks },
      (_, i) => i + 1
    ).filter(num => !uploadedSet.has(num));

    const canResume = missingChunks.length > 0 && uploadedParts.length > 0;

    console.log(`[RESUME] Check for ${filename}: exists=${true}, uploaded=${uploadedParts.length}, missing=${missingChunks.length}`);

    return NextResponse.json({
      exists: true,
      file_id: existingFile.id,
      uploaded_chunks: uploadedParts,
      missing_chunks: missingChunks,
      total_chunks: totalChunks,
      can_resume: canResume
    });

  } catch (err) {
    console.error('Resume check error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to check resume status' },
      { status: 500 }
    );
  }
}
```

---

## Step 4: Update FileService (2 hours)

### 4.1 Update handleUploadChunk

```javascript
// lib/fileService.js

async handleUploadChunk(userId, body) {
  const {
    file_id,
    part_number,
    total_parts,
    chunk_size,
    original_filename,
    mime_type,
    folder_id,
    telegram_file_id,
    iv,
    auth_tag,
    encrypted_file_key,
    key_iv,
    encryption_version,
    is_compressed
  } = body;

  const isLastChunk = parseInt(part_number, 10) === parseInt(total_parts, 10);

  let fileRecord = await fileRepository.findById(file_id);

  // Step 1: Create or Update file entry on first chunk
  if (part_number === 1) {
    const fileExt = getFileExtension(original_filename);
    const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';
    const decryptedSize = parseInt(chunk_size, 10);

    if (!fileRecord) {
      fileRecord = await fileRepository.save({
        id: file_id,
        user_id: userId,
        folder_id: folder_id || null,
        original_filename,
        file_size: decryptedSize * total_parts,
        file_type: fileExt,
        mime_type: mimeType,
        is_encrypted: true,
        encryption_algo: 'AES-256-GCM',
        encrypted_file_key: encrypted_file_key || null,
        key_iv: key_iv || null,
        encryption_version: encryption_version || 1,
        is_complete: false, // NEW: Mark as incomplete
        total_parts_expected: total_parts // NEW: Store expected parts
      });
    } else {
      // Resume case: Update existing record
      fileRecord.encrypted_file_key = encrypted_file_key || fileRecord.encrypted_file_key;
      fileRecord.key_iv = key_iv || fileRecord.key_iv;
      fileRecord.encryption_version = encryption_version || fileRecord.encryption_version;
      fileRecord.file_size = decryptedSize * total_parts;
      fileRecord.total_parts_expected = total_parts; // NEW
      fileRecord.updated_at = new Date();
      fileRecord.is_complete = false; // NEW: Reset on resume
      await fileRepository.save(fileRecord);

      // Clear OLD chunks to avoid duplicates on resume
      await filePartRepository.deleteByFileId(file_id);
    }
  }

  // Step 2: Check if chunk already exists (prevent duplicates)
  const existingPart = await filePartRepository.findByFileIdAndPart(
    file_id,
    part_number
  );

  if (existingPart) {
    console.log(`[UPLOAD] Part ${part_number} already exists, skipping duplicate upload`);
    return { fileRecord, isLastChunk: false };
  }

  // Step 3: Select bot for tracking
  const bot = await userBotRepository.getNextBotForUpload(userId);
  const botId = bot?.id || null;

  // Step 4: Save chunk metadata
  await filePartRepository.save({
    id: uuidv4(),
    file_id,
    telegram_file_id,
    part_number,
    size: chunk_size,
    iv,
    auth_tag,
    bot_id: botId,
    is_compressed: is_compressed || false
  });

  if (botId) {
    await userBotRepository.incrementUploadCount(botId);
  }

  // Step 5: Finalize if last chunk
  if (isLastChunk) {
    // Mark as complete
    await fileRepository.markComplete(file_id); // NEW

    // Calculate total size based on all parts
    const parts = await filePartRepository.findByFileId(file_id);
    const finalFileSize = parts.reduce((sum, p) => sum + BigInt(p.size || 0), BigInt(0));
    await this.finalizeFileUpload(userId, file_id, finalFileSize, folder_id, botId);
  }

  return { fileRecord, isLastChunk };
}
```

---

## Step 5: Update Browser Encryption (3 hours)

### 5.1 Modify encryptFileChunks Signature

```javascript
// lib/browserUploadEncryption.js

/**
 * Encrypt file on browser and upload chunks to server
 * Supports resumable uploads by skipping already-uploaded chunks
 *
 * @param {File} file - File object from input
 * @param {string} password - Encryption password
 * @param {Function} onProgress - Callback(partNumber, totalParts, stage)
 * @param {string} folderId - Optional folder ID
 * @param {AbortSignal} abortSignal - For cancellation
 * @param {string} targetFileId - For resume: existing file_id (NEW)
 * @param {number} resumeChunkStart - First chunk to upload (NEW)
 * @returns {Promise<{file_id, total_parts, filename}>}
 */
export async function encryptFileChunks(
  file,
  password,
  onProgress,
  folderId,
  abortSignal = null,
  targetFileId = null,
  resumeChunkStart = 1
) {
  if (!file) {
    throw new Error('File is required');
  }

  if (!password) {
    throw new Error('Password is required for encrypted upload');
  }

  try {
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Determine file ID
    const fileId = targetFileId || generateFileId();
    
    // If resuming, log it
    if (targetFileId) {
      console.log(`📝 RESUMING upload: file_id=${fileId}, starting from chunk ${resumeChunkStart}`);
    } else {
      console.log(`📁 Starting NEW encrypted upload: ${file.name} (${formatBytes(file.size)})`);
    }

    console.log(`🔐 File ID: ${fileId}`);

    // Pre-calculate chunks
    const chunkSizes = [];
    let remainingSize = file.size;
    while (remainingSize > 0) {
      const size = getRandomChunkSize();
      const actualSize = Math.min(size, remainingSize);
      chunkSizes.push(actualSize);
      remainingSize -= actualSize;
    }
    const totalParts = chunkSizes.length;
    console.log(`📦 Calculated total chunks: ${totalParts}`);

    // Fetch encryption config
    onProgress?.(0, totalParts, 'Fetching encryption configuration...');
    const settingsRes = await fetch('/api/settings');
    const settings = await settingsRes.json();
    const salt = settings.encryptionSalt;

    onProgress?.(0, totalParts, 'Deriving encryption key...');
    const dek = generateDEK();
    const wrapped = await wrapKey(dek, password, salt);
    const key = dek;
    console.log(`✓ DEK generated and wrapped`);

    // Process chunks with streaming
    const stream = file.stream();
    const reader = stream.getReader();

    let partNumber = 0;
    let buffer = new Uint8Array(0);
    let activeUploads = [];
    let completedParts = 0;

    const processUpload = async (chunkData, pNum) => {
      // Determine if chunk should be compressed
      let dataToEncrypt = chunkData;
      let isCompressed = false;

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') ||
                      ['pdf', 'zip', 'rar', '7z', 'gz', 'mp4', 'mov', 'jpg', 'jpeg', 'png', 'gif'].includes(fileExt);

      if (!isMedia || file.type === 'image/svg+xml') {
        try {
          const compressed = await compressData(chunkData);
          if (compressed.length < chunkData.length * 0.95) {
            dataToEncrypt = compressed;
            isCompressed = true;
          }
        } catch (err) {
          console.warn(`[UPLOAD] Compression failed for chunk ${pNum}, using raw data`, err);
        }
      }

      // Encrypt chunk
      onProgress?.(completedParts, totalParts, `Encrypting chunk ${pNum}/${totalParts}${isCompressed ? ' (GZIP)' : ''}...`);
      const { encrypted_data, iv, auth_tag } = await encryptChunk(dataToEncrypt, key);

      // Upload encrypted chunk
      onProgress?.(completedParts, totalParts, `Uploading chunk ${pNum}/${totalParts}...`);
      await uploadEncryptedChunk(
        fileId,
        pNum,
        totalParts,
        encrypted_data,
        iv,
        auth_tag,
        chunkData.length,
        file.name,
        file.type,
        folderId,
        onProgress,
        abortSignal,
        pNum === 1 ? wrapped.wrappedKey : null,
        pNum === 1 ? wrapped.iv : null,
        2,
        isCompressed
      );

      completedParts++;
      onProgress?.(completedParts, totalParts, `Completed chunk ${pNum}/${totalParts}`);
      console.log(`✓ Chunk ${pNum} uploaded`);
    };

    // Main streaming loop
    while (true) {
      if (abortSignal?.aborted) throw new Error('Upload cancelled by user');

      const { done, value } = await reader.read();
      if (value) {
        buffer = concatenateUint8Arrays(buffer, new Uint8Array(value));
      }

      // Extract and process chunks
      while (partNumber < totalParts) {
        const currentChunkSize = chunkSizes[partNumber];

        if (buffer.length >= currentChunkSize || (done && buffer.length > 0)) {
          const chunkData = buffer.slice(0, Math.min(buffer.length, currentChunkSize));
          buffer = buffer.slice(chunkData.length);

          partNumber++;
          const currentPartNum = partNumber;

          // NEW: Skip chunks that are already uploaded (resume logic)
          if (currentPartNum < resumeChunkStart) {
            console.log(`⏭️  Skipping chunk ${currentPartNum} (already uploaded)`);
            onProgress?.(currentPartNum, totalParts, `Skipped chunk ${currentPartNum} (already uploaded)`);
            continue;
          }

          // Process part 1 sequentially to ensure file record is created
          if (currentPartNum === 1 || currentPartNum === resumeChunkStart) {
            console.log(`[UPLOAD] Processing part ${currentPartNum} sequentially...`);
            await processUpload(chunkData, currentPartNum);
          } else {
            // Use parallel uploads for others
            if (activeUploads.length >= MAX_CONCURRENT_CHUNKS) {
              await Promise.race(activeUploads);
            }

            const uploadPromise = processUpload(chunkData, currentPartNum).then(() => {
              activeUploads = activeUploads.filter(p => p !== uploadPromise);
            });
            activeUploads.push(uploadPromise);
          }
        } else {
          break;
        }
      }

      if (done) break;
    }

    // Wait for remaining uploads
    if (activeUploads.length > 0) {
      onProgress?.(completedParts, totalParts, 'Finishing remaining uploads...');
      await Promise.all(activeUploads);
    }

    onProgress?.(totalParts, totalParts, 'Upload complete!');
    console.log(`✅ All ${totalParts} chunks uploaded successfully`);

    return {
      file_id: fileId,
      total_parts: totalParts,
      filename: file.name,
      size: file.size,
      is_encrypted: true,
      resumed: !!targetFileId
    };
  } catch (err) {
    console.error('Encrypted upload error:', err);
    throw err;
  }
}
```

---

## Step 6: Update UploadForm Component (3 hours)

### 6.1 Detect and Resume

```javascript
// app/components/UploadForm.jsx

const uploadFile = useCallback(async (fileItem, password) => {
  console.log(`[UPLOAD] ${fileItem.id} - Starting upload: ${fileItem.file.name}`);

  const abortController = new AbortController();
  abortControllersRef.current.set(fileItem.id, abortController);

  updateFileStatus(fileItem.id, 'uploading', 0);

  try {
    // NEW: Check for resumable upload
    console.log(`[UPLOAD] ${fileItem.id} - Checking for existing upload...`);
    const checkRes = await fetch(
      `/api/upload/check?filename=${encodeURIComponent(fileItem.file.name)}&size=${fileItem.file.size}`,
      { signal: abortController.signal }
    );
    const checkData = await checkRes.json();

    let fileId = null;
    let resumeFrom = 1;
    let isResume = false;

    if (checkData.exists && checkData.can_resume) {
      fileId = checkData.file_id;
      resumeFrom = Math.min(...checkData.missing_chunks);
      isResume = true;
      console.log(`[UPLOAD] ${fileItem.id} - ✓ Resume available: chunks ${resumeFrom}-${checkData.total_chunks}`);
      updateFileStatus(
        fileItem.id,
        'uploading',
        (resumeFrom / checkData.total_chunks) * 100,
        null,
        `Resuming from chunk ${resumeFrom}/${checkData.total_chunks}`
      );
    } else if (checkData.exists) {
      console.log(`[UPLOAD] ${fileItem.id} - Upload exists but already complete`);
      updateFileStatus(fileItem.id, 'error', 0, 'File already uploaded');
      return;
    }

    // Proceed with encryption
    await encryptFileChunks(
      fileItem.file,
      password,
      (partNumber, totalParts, stage) => {
        const progress = (partNumber / totalParts) * 100;
        updateFileStatus(fileItem.id, 'uploading', progress, null, stage);
        console.log(`[UPLOAD] ${fileItem.id} - ${stage} (${partNumber}/${totalParts})`);
      },
      currentFolderId,
      abortController.signal,
      fileId,        // NEW: Pass file_id for resume
      resumeFrom      // NEW: Pass resume starting point
    );

    console.log(`[UPLOAD] ${fileItem.id} - ✓ Encrypted upload successful${isResume ? ' (resumed)' : ''}`);
    updateFileStatus(fileItem.id, 'success', 100);

    if (onFileUploaded) onFileUploaded();

    // Remove from queue after completion
    setTimeout(() => {
      setQueue(prev => prev.filter(f => f.id !== fileItem.id));
    }, 5000);

  } catch (err) {
    if (err.message.includes('cancelled') || err.message.includes('Abort')) {
      console.log(`[UPLOAD] ${fileItem.id} - Cancelled by user`);
    } else {
      console.error(`[UPLOAD] ${fileItem.id} - FAILED:`, err.message);
      updateFileStatus(fileItem.id, 'error', 0, err.message);
    }
  } finally {
    abortControllersRef.current.delete(fileItem.id);
  }
}, [currentFolderId, onFileUploaded, updateFileStatus]);
```

### 6.2 Update UI to Show Resume Status

```jsx
// In the queue item rendering
{item.status === 'uploading' && item.progressStage?.includes('Resuming') && (
  <div className="bg-blue-50 border-l-4 border-blue-500 p-2 mb-2">
    <p className="text-xs font-semibold text-blue-700">
      {item.progressStage}
    </p>
  </div>
)}
```

---

## Step 7: Update API Route (0.5 hours)

### 7.1 No changes needed to POST /api/upload/chunk

The existing endpoint already handles:
- Checking for duplicate parts (via filePartRepository)
- Updating is_complete on last chunk (via fileService)

Just ensure it uses the updated fileService.handleUploadChunk()

---

## Step 8: Testing (3 hours)

### 8.1 Unit Tests

```javascript
// __tests__/resumeUpload.test.js

import { encryptFileChunks } from '@/lib/browserUploadEncryption';

describe('Resumable Uploads', () => {
  test('should skip chunks before resumeChunkStart', async () => {
    const file = new File(['a'.repeat(10 * 1024 * 1024)], 'test.txt');
    const uploadedChunks = [];

    // Mock uploadEncryptedChunk to track calls
    global.uploadEncryptedChunk = jest.fn(async (fileId, partNum) => {
      uploadedChunks.push(partNum);
    });

    await encryptFileChunks(
      file,
      'password',
      () => {},
      null,
      null,
      'existing-file-id',
      5  // Skip chunks 1-4
    );

    // Verify chunks 1-4 were not uploaded
    expect(uploadedChunks.every(c => c >= 5)).toBe(true);
  });

  test('should detect resumable upload via API', async () => {
    // Create partial upload
    const res = await fetch('/api/upload/check?filename=test.txt&size=1000');
    const data = await res.json();

    expect(data.can_resume).toBe(true);
    expect(data.missing_chunks.length).toBeGreaterThan(0);
  });
});
```

### 8.2 Manual Testing Checklist

- [ ] Upload file (5MB), stop after 50%, refresh page
- [ ] Click upload same file again
- [ ] Verify API returns `can_resume: true`
- [ ] Verify progress starts from ~50% instead of 0%
- [ ] Verify only remaining chunks are uploaded
- [ ] Monitor network tab to confirm chunks are skipped
- [ ] Test with network throttling (DevTools)
- [ ] Test with network failure (stop upload mid-way, resume)
- [ ] Verify file is complete and downloads correctly

---

## Step 9: Deployment (1 hour)

### 9.1 Pre-deployment

```bash
# Test migrations locally
sqlite3 db/files.db < db/migrations/003_add_resumable_upload_support.sql

# Run tests
npm test

# Build
npm run build
```

### 9.2 Deployment Steps

1. **Database Migration**
   - Deploy migration script
   - Run: `npm run migrate:latest`

2. **Code Deployment**
   - Deploy new API endpoint (`/api/upload/check`)
   - Deploy updated `lib/browserUploadEncryption.js`
   - Deploy updated `app/components/UploadForm.jsx`
   - Deploy updated `lib/fileService.js`

3. **Verification**
   - Monitor logs for resume events
   - Test resume upload with real files
   - Verify database indexes are created

---

## Complete Checklist

### Code Changes
- [ ] Add 3 columns to files table (migration)
- [ ] Add upload_sessions table (migration)
- [ ] Add indexes (migration)
- [ ] Create `app/api/upload/check/route.js`
- [ ] Update `FileRepository.findByUserFilenameSize()`
- [ ] Update `FileRepository.markComplete()`
- [ ] Update `FilePartRepository.findByFileIdAndPart()`
- [ ] Update `FilePartRepository.getUploadedPartNumbers()`
- [ ] Update `fileService.handleUploadChunk()` (skip duplicates, mark complete)
- [ ] Update `lib/browserUploadEncryption.encryptFileChunks()` (add resumeChunkStart param)
- [ ] Update `app/components/UploadForm.jsx` (detect and resume)

### Testing
- [ ] Unit tests for resume detection
- [ ] Unit tests for duplicate skip
- [ ] Integration test for full resume cycle
- [ ] Manual test with network throttling
- [ ] Manual test with interrupted upload

### Documentation
- [ ] Update README with resume feature
- [ ] Add to CHANGELOG.md
- [ ] Document new API endpoint

### Monitoring
- [ ] Add logging for resume events
- [ ] Monitor for resume failures
- [ ] Track resume success rate

---

## Performance Metrics

After implementation, track:

```
- Resume detection time (target: <100ms)
- Percentage of uploads that resume vs start fresh
- Reduction in total bytes uploaded (should be ~30-50% less for interrupted uploads)
- User satisfaction (fewer failed uploads)
```

---

## Rollback Plan

If issues arise:

1. **API Endpoint**: Disable by commenting out route file
2. **Database**: Add `is_complete` back to false for all files
3. **Client**: Remove resume logic from UploadForm (fallback to generateFileId)

All backward compatible - old uploads continue to work.

