# Bug Fix: CHUNK_DEMUXER_ERROR_APPEND_FAILED on Seek to Unbuffered Area

## Problem
When users seek to an unbuffered portion of a fragmented MP4 video in progressive playback mode, the video element enters an error state:
```
CHUNK_DEMUXER_ERROR_APPEND_FAILED: Failed to prepare video sample for decode
HTMLMediaElement.error: not null
Failed to execute 'appendBuffer' on 'SourceBuffer': The HTMLMediaElement.error attribute is not null
```

This happens because:

1. **Out-of-order chunk appends**: `loadChunksOnDemand` was fetching and appending chunks as they completed, without ensuring they arrived in order
2. **No contiguity enforcement**: MediaSource API requires appended chunks to maintain continuous timestamps - any gap breaks the buffer
3. **No error state recovery**: Once the video element entered error state (via `videoRef.current.error`), all subsequent appends would fail
4. **Weak seek calculations**: Using byte-position-based estimation was unreliable; switched to time-based calculation

## Solution

### 1. Fixed `loadChunksOnDemand` Function (Lines 266-320)
**Before**: Fetched and appended chunks concurrently as they completed
```javascript
// Bad: chunks append as they finish, possibly out of order
for (let i = startChunk; i <= endChunk; i++) {
  const { decrypted } = await fetchAndDecryptChunk(...);
  await appendToSourceBuffer(...);  // append immediately
}
```

**After**: Fetch all chunks first, THEN append in order
```javascript
// Good: fetch all chunks, then append in strict order
const chunksToAppend = [];
for (let i = startChunk; i <= endChunk; i++) {
  const { decrypted } = await fetchAndDecryptChunk(...);
  chunksToAppend.push({ chunkNum: i, decrypted });
}

// Only THEN append in order
for (const { chunkNum, decrypted } of chunksToAppend) {
  await appendToSourceBuffer(...);
}
```

**Why this works**: 
- Fetch operations can complete in any order (network latency varies)
- MediaSource requires contiguous timestamps, which is only guaranteed if we append in chunk order
- Prevents "timestamp is less than the end timestamp" errors

### 2. Improved Seek Handler (Lines 936-991)
**Changes**:
- **Error state check**: If video element is already in error, reject the seek load request immediately
- **Better duration validation**: Ensure duration is positive and finite before calculations
- **Time-based chunk calculation**: Changed from byte-position-based to time-based
  ```javascript
  // Old (unreliable)
  const estimatedBytePos = fileSize * progressRatio;
  const avgChunkSize = fileSize / totalChunksRef.current;
  const estimatedChunk = Math.ceil(estimatedBytePos / avgChunkSize);
  
  // New (reliable)
  const secondsPerChunk = totalDuration / totalChunksRef.current;
  const estimatedChunk = Math.ceil(clampedSeekTime / secondsPerChunk);
  ```
- **Async loading without blocking**: Changed from no-await to explicit error handling
  ```javascript
  loadChunksOnDemand(...).catch(err => console.error(...));
  ```

### 3. Improved Background Loader Error Handling (Lines 722-735)
**Added**: If video element enters error state during background loading, stop the background loader immediately
```javascript
if (videoRef.current?.error) {
  console.error(`[VideoPlayer] Video element error during background load`);
  clearInterval(backgroundLoader);
  allChunksLoaded = true;
  return;
}
```

## Key Insights

### Why CHUNK_DEMUXER_ERROR_APPEND_FAILED Occurs
The Chromium demuxer validates:
1. **Chunk order**: Each chunk's timestamp must be >= the previous chunk's end timestamp
2. **Continuity**: Cannot append chunk 5 if chunk 4 hasn't been appended yet (or if buffered range is `[0-2s][5-7s]`)
3. **Valid initialization**: Init segment (ftyp+moov) must precede all media chunks

When `loadChunksOnDemand` appended chunks as they fetched (out of order), MediaSource would try to insert timestamps that don't align, causing the demuxer to reject the append.

### Why Fetch-First Approach Works
1. **Fetch operations are network I/O**: Completion order is unpredictable
2. **Append operations are CPU I/O**: Validation happens synchronously
3. By separating fetch (network) from append (validation), we guarantee order at the critical point (append)

### Duration Calculation Impact
Incorrect duration cascades to seek calculations:
- If `mediaSource.duration` is wrong, `secondsPerChunk` is wrong
- Wrong chunk estimate means loading wrong chunks
- Loading "near" chunks but not the actual seek target leaves gaps

The fallback `estimatedDuration = totalChunks * 25` works because:
- Average chunk is 2-3 MB
- Average video bitrate is 2-5 Mbps
- 25 seconds per chunk is conservative middle ground

## Testing Recommendations

1. **Seek forward aggressively**: Click far ahead on timeline (e.g., 80% done)
2. **Seek backward after forward seek**: Test gap-filling logic
3. **Rapid seeks**: Click multiple times quickly - tests concurrency
4. **Monitor console**: Look for:
   - `[VideoPlayer] Seek to XXs (unbuffered)`
   - `[VideoPlayer] Loading chunks X-Y to fill gap`
   - `[VideoPlayer] Fetched N chunks, appending in order`
   - No `CHUNK_DEMUXER_ERROR` messages

## Files Modified
- `app/components/VideoPlayer.jsx`: Lines 266-320, 722-735, 936-991
