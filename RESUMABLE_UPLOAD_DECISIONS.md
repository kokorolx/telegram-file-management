# Resumable Upload - Design Decisions & Trade-offs

## Quick Decision Matrix

| Decision | Option A | Option B | **Recommended** | Trade-off |
|----------|----------|----------|-----------|-----------|
| **Resume Detection** | File hash (SHA-256) | Filename + size | **Hybrid** | Hash is slower but more accurate |
| **Resume State Storage** | Database only | localStorage + DB | **Both** | localStorage for UX, DB for recovery |
| **Chunk Verification** | Always verify | On-demand only | **On-demand** | Slower but required for data integrity |
| **Auto-cleanup** | Immediate | 7-day TTL | **7-day TTL** | User might want to resume later |
| **Duplicate Detection** | Part number check | File ID + part | **Both** | Redundant but safe |
| **Encryption on Resume** | Re-encrypt chunks | Skip chunks | **Skip chunks** | Different IV = different ciphertext |

---

## 1. Resume Detection Strategy

### Decision: HYBRID (Filename + Size + Optional Hash)

#### Why Not Hash-Based Only?

```
Pros:
  ✓ Works for identical files (same content = same hash)
  ✓ Handles file renames
  ✓ Prevents duplicate upload detection issues

Cons:
  ✗ SHA-256 on 500MB file = 2-3 seconds
  ✗ CPU intensive on client
  ✗ Not necessary for most cases
  ✗ User can't be certain which file they're resuming
```

#### Why Not Filename + Size Only?

```
Pros:
  ✓ Instant detection (<10ms)
  ✓ No hashing overhead
  ✓ Works for same-device uploads

Cons:
  ✗ Ambiguous if user has duplicate files
  ✗ Doesn't work for different versions of same file
  ✗ User might upload file A, delete it, upload file B with same name/size
```

#### Recommended: Hybrid Approach

```javascript
// Step 1: Fast lookup by filename + size
const candidates = await db.files.find({
  user_id: userId,
  original_filename: filename,
  file_size: size,
  is_complete: false
});

// Step 2: Handle ambiguity
if (candidates.length === 1) {
  // Unambiguous - use it
  resume_file_id = candidates[0].id;
} else if (candidates.length > 1) {
  // Multiple candidates - calculate hash and confirm
  const hash = await calculateFileHash(file);
  const confirmed = candidates.find(c => c.file_hash === hash);
  
  if (confirmed) {
    resume_file_id = confirmed.id;
  } else {
    // No match - ask user which one
    showResumeDialog(candidates);
  }
} else {
  // No candidates - new upload
  resume_file_id = null;
}
```

**Implementation Cost**: LOW (filename + size only for MVP)

---

## 2. When to Calculate File Hash

### Decision: OPTIONAL, ON-DEMAND

#### When to Hash

- User explicitly selects "Resume with verification"
- Ambiguous resume candidates (>1 match)
- Server-side integrity checks (Phase 3)

#### When NOT to Hash

- First upload attempt (waste of time)
- Single unambiguous candidate (filename + size unique)
- Client on slow connection (battery/data concern)

```javascript
// Only hash if needed
const isAmbiguous = candidates.length > 1;
const needsHash = isAmbiguous || userRequestedVerification;

if (needsHash) {
  const hash = await calculateFileHash(file);
  // ... verify ...
} else {
  // Use candidate directly
}
```

---

## 3. Chunk Re-encryption on Resume

### Decision: DO NOT RE-ENCRYPT

#### Why Not?

```
Scenario: Same file, same password, resume

Current approach (doesn't re-encrypt):
  Chunk 1: Plaintext → Encrypt(IV1) → Ciphertext1 ← Store in Telegram
  Resume:
  Chunk 2: Plaintext → Encrypt(IV2) → Ciphertext2 ← Store in Telegram
  [Different IVs, different ciphertexts - correct]

Alternative (re-encrypt all):
  Chunk 1: Plaintext → Encrypt(IV3) → Ciphertext3 ← Different from Ciphertext1!
  Problem: We'd need to:
    1. Find and delete Ciphertext1 from storage
    2. Re-upload Ciphertext3
    3. Update database telegram_file_id
    4. Risk of data loss if deletion fails

  This defeats the purpose of resume!
```

**Decision**: Keep existing encrypted chunks, only encrypt new ones.

---

## 4. Resume State Storage Location

### Decision: DUAL (localStorage + Database)

#### localStorage Benefits

```
✓ User sees "Resume X from 50%" immediately on page load
✓ Survives page refresh (UX improvement)
✓ Client-side only (no DB query needed)
✓ Can resume even if server is temporarily down
```

#### localStorage Limitations

```
✗ Cleared if user clears browser cache
✗ Browser-specific (different device = can't resume)
✗ Unencrypted (but just contains file metadata, not encryption keys)
```

#### Database Benefits

```
✓ Survives browser clearing
✓ Works across devices
✓ Can cleanup old sessions (7-day TTL)
✓ Server can validate resume legitimacy
```

#### Implementation

```javascript
// Client-side
const resumeKey = `upload_resume_${file_id}`;
localStorage.setItem(resumeKey, JSON.stringify({
  file_id,
  filename,
  fileSize,
  uploadedChunks: [1,2,3,...],
  timestamp: Date.now()
}));

// Server-side (upload_sessions table)
INSERT INTO upload_sessions (
  id, user_id, file_id, uploaded_parts, last_activity_at, expires_at
) VALUES (...)
```

---

## 5. Duplicate Chunk Prevention

### Decision: MULTI-LAYER DEFENSE

#### Layer 1: Database Unique Constraint

```sql
-- Prevent two rows with same file_id + part_number
ALTER TABLE file_parts ADD UNIQUE(file_id, part_number);
```

#### Layer 2: Query Check Before Insert

```javascript
const existing = await filePartRepository.findByFileIdAndPart(fileId, partNumber);
if (existing) {
  console.log('Part already exists, skipping');
  return { success: true, skipped: true };
}
```

#### Layer 3: Idempotent Response

```javascript
// Even if somehow inserted twice, don't fail
if (isLastChunk) {
  // Check if already finalized
  if (file.is_complete) {
    return { success: true, status: 'already_complete' };
  }
}
```

**Why Multi-layer?**
- Layer 1: Database prevents impossible states
- Layer 2: Application logic prevents unnecessary work
- Layer 3: API remains idempotent (safe to retry)

---

## 6. Auto-Cleanup of Abandoned Uploads

### Decision: 7-DAY TTL

#### Why Not Immediate?

```
❌ User might want to resume tomorrow
❌ User might close browser and come back later
❌ Connection might be down for hours
```

#### Why Not Permanent?

```
❌ Storage fills up with orphaned chunks
❌ No incentive for user to clean up
❌ Server resources wasted
```

#### 7-Day TTL Rationale

```
✓ Reasonable for most users
✓ Chunks typically uploaded within 1-7 days
✓ Aligns with typical user patterns
✓ Can be configured per deployment
```

#### Implementation

```sql
-- expires_at timestamp on upload_sessions table
-- Cron job to cleanup

DELETE FROM upload_sessions 
WHERE expires_at < NOW() 
  AND status = 'in_progress';

-- Cascade: file_parts and files also deleted if orphaned
```

---

## 7. Progress Calculation During Resume

### Decision: ACCOUNT FOR ALREADY-UPLOADED CHUNKS

#### Wrong Approach

```javascript
// Shows 0% even though 50% already uploaded
const progress = (currentChunk / totalChunks) * 100;
```

#### Correct Approach

```javascript
// Account for already-uploaded chunks
const uploadedChunks = [1, 2, 3, ... 50];
const alreadyDone = uploadedChunks.length;
const remaining = totalChunks - alreadyDone;
const progress = ((alreadyDone + currentChunk) / totalChunks) * 100;

// Shows 75% when uploading chunk 75 out of 100 (50 already done)
```

---

## 8. Error Recovery Strategy

### Scenario: Network Fails During Resume

```
State: Chunks 1-50 uploaded, resuming at 51
Event: Network fails during chunk 75
User: Clicks "Resume" again

What Happens:

1. API /upload/check called
2. Returns: { uploaded_chunks: [1-74], missing_chunks: [75-100] }
3. Resume from chunk 75 again
4. If chunk 75 is stuck, next resume will try again

Idempotent: Yes, safe to retry
Convergent: Yes, eventually completes
```

### Scenario: Server Crashes During Chunk Save

```
State: Chunk received, encrypted file stored in Telegram, database not updated
Recovery: 
  - Chunk IS in storage (safe)
  - Database record NOT created (but file_parts unique constraint prevents duplicate)
  - Next resume: Part verification API can detect orphaned chunk
  - User can verify and clean up
```

---

## 9. Security Implications

### Encryption Key Management

#### Question: Does Resume Need New DEK?

```
No. Because:
  ✓ Same file_id
  ✓ Same password
  ✓ Same encryption salt
  → Same DEK (derived key is deterministic)
  → Same wrapped key in database
```

#### Question: Is Storing DEK Dangerous?

```
Answer: No, because:
  ✓ DEK is wrapped with master password
  ✓ Wrapped DEK is stored in database (encrypted)
  ✓ Without password, wrapped key is useless
  ✓ Same as current system (no change)
```

#### Question: IV Reuse Risk?

```
No, because:
  ✓ Each chunk has unique random IV
  ✓ IV is generated fresh each time (not deterministic)
  ✓ Even if chunk is resumed, new IV is used
  ✓ AES-GCM requires unique IV per encryption operation
  ✓ This is already enforced (see browserUploadEncryption.js line 233)
```

### Authentication

Resume is gated by:

```javascript
// 1. User authentication (existing)
const auth = await requireAuth(request);

// 2. User ownership check (new)
if (user.id !== file.user_id) {
  throw new Error('Unauthorized');
}

// 3. File integrity (optional, Phase 3)
if (file.file_hash !== providedHash) {
  throw new Error('File mismatch');
}
```

---

## 10. Backward Compatibility

### Question: Will Old Uploads Be Affected?

```
Answer: No

Old files:
  - Don't have file_hash column (nullable)
  - Don't have is_complete = true initially
  - Can still be downloaded (no change)
  - Can't be resumed (no file_hash match)

New uploads:
  - Have file_hash calculated
  - Have is_complete flag
  - Can be resumed

Mixed system: Works fine
```

---

## 11. Feature Flags (For Phased Rollout)

### Option: Use Feature Flags

```javascript
// config.js
export const FEATURES = {
  RESUMABLE_UPLOADS: process.env.ENABLE_RESUMABLE_UPLOADS === 'true',
  CHUNK_VERIFICATION: process.env.ENABLE_CHUNK_VERIFICATION === 'true',
  AUTO_CLEANUP: process.env.ENABLE_AUTO_CLEANUP === 'true'
};

// Usage
if (FEATURES.RESUMABLE_UPLOADS) {
  // Check for resume
  const checkRes = await fetch('/api/upload/check?...');
}
```

### Deployment Strategy

1. **Day 1**: Deploy code with flag OFF
   - API endpoints exist but not called
   - Database schema ready
   - Backward compatible

2. **Day 2**: Enable flag for 10% of users
   - Monitor for issues
   - Gather metrics

3. **Day 5**: Enable for 50% of users
   - Verify no regressions
   - Performance acceptable

4. **Day 10**: Enable for all users
   - Gradual rollout complete
   - Easy rollback if issues

---

## 12. Cost-Benefit Analysis

### Development Cost

| Component | Hours | Complexity |
|-----------|-------|-----------|
| Database migration | 1 | Low |
| API endpoints | 2 | Low |
| Client-side logic | 4 | Medium |
| Testing | 3 | Medium |
| Documentation | 2 | Low |
| **TOTAL** | **12** | **Low-Medium** |

### User Benefits

| Scenario | Current | With Resume | Improvement |
|----------|---------|-------------|-------------|
| 500MB file, 50% interrupted | Re-upload all 250MB | Upload remaining 250MB | **50% reduction** |
| Poor connection | Frequent failures | Able to resume | **Much better UX** |
| Browser crash | Lose progress | Resume after restart | **No user frustration** |
| Multiple retries | Exponential data | Linear only remaining | **Optimal efficiency** |

### Storage Cost Impact

```
Current system: 1MB file uploaded 5 times = 5MB storage
With resume: 1MB file + 4 retries of last 20% = 1.8MB storage
Savings: ~64% reduction in failed upload data
```

---

## Final Recommendation

### MVP Implementation (Phase 1)

```javascript
✅ Database: Add file_hash, is_complete, total_parts_expected
✅ API: GET /api/upload/check (filename + size based)
✅ Client: Detect resume, skip already-uploaded chunks
✅ FileService: Check for duplicates, mark complete

Time: 20-30 hours
ROI: High (solves major pain point)
Risk: Low (backward compatible, easy rollback)
```

### Phase 2 Enhancement (Optional)

```javascript
⏳ localStorage for faster resume
⏳ Improved UI feedback
⏳ Auto-cleanup cron job

Time: 10-15 hours
ROI: Medium (better UX)
Risk: Low
```

### Phase 3 Robustness (If Needed)

```javascript
⏳ Chunk verification
⏳ File hash validation
⏳ Corrupted chunk re-upload

Time: 15-20 hours
ROI: Lower (rare scenarios)
Risk: Low
```

---

## Decision Scorecard

| Factor | Recommendation | Confidence |
|--------|---|---|
| **Feasibility** | Hybrid detection (filename+size) | ⭐⭐⭐⭐⭐ |
| **User Value** | High (solves major UX issue) | ⭐⭐⭐⭐⭐ |
| **Implementation Complexity** | Low-Medium | ⭐⭐⭐⭐ |
| **Risk** | Very Low | ⭐⭐⭐⭐⭐ |
| **Backward Compatibility** | Full | ⭐⭐⭐⭐⭐ |
| **Performance Impact** | Negligible | ⭐⭐⭐⭐⭐ |
| **Security Impact** | None (net positive) | ⭐⭐⭐⭐⭐ |

**Overall Recommendation: PROCEED WITH PHASE 1 MVP**

