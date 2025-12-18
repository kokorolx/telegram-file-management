# Video Streaming Architecture: Why Your Chunks Won't Play

## The Core Problem You're Facing

You're uploading videos as encrypted 2MB chunks to Telegram. When you try to reassemble them in your stream endpoint and play them, the video player gets nothing. This is **not** a decryption problem—it's a **video container structure** problem.

---

## Part 1: Understanding MP4 File Structure

### What is an MP4 File?

An MP4 file is NOT just binary video data concatenated together. It's a **structured container format** with multiple "atoms" (also called boxes). Think of it like a file system inside a file.

```
MP4 File Structure:
┌─────────────────────────────────────┐
│ FTYP (File Type Atom)               │ ← Usually 20-100 bytes
├─────────────────────────────────────┤
│ MOOV (Movie Atom - Metadata)        │ ← Usually 100KB-5MB
│  • Duration                         │   (depends on frame count)
│  • Codec info (H.264, H.265, etc)  │
│  • Frame timestamps                 │
│  • Chunk offsets (CRITICAL!)        │
├─────────────────────────────────────┤
│ MDAT (Media Data Atom)              │ ← Actual video bytes
│ • Compressed video frames           │   (Can be 1GB+)
│ • Audio samples                     │
└─────────────────────────────────────┘
```

### The MOOV Atom: Your Secret Problem

The **MOOV atom is a "table of contents"** for your video. It contains critical seek information:

- **Frame timestamps**: "Frame 30 is at 00:01.000"
- **Chunk offsets**: "Frame 30 data starts at **byte 45,382** in the MDAT"
- **Track metadata**: Video codec, resolution, audio codec, etc.

**Key insight**: These offsets are **absolute byte positions** in the file.

---

## Part 2: Why Naive Chunking Breaks Everything

### Your Current Approach (Broken)

```
Original Video File (500MB):
┌─────────────────────────────────────┐
│ FTYP                                │
│ MOOV (contains offsets like 45382)  │
│ MDAT                                │
│   Bytes 0-45382: Video start        │
│   Bytes 45382-45500: Frame 30       │
│   ...                               │
└─────────────────────────────────────┘

You split it into 2MB chunks:
Chunk 1: Bytes 0-2097152              ← Contains MOOV with offset "45382"
Chunk 2: Bytes 2097152-4194304
Chunk 3: Bytes 4194304-6291456
...

When reassembled:
MOOV still says: "Frame 30 is at byte 45382"
But now the file is DECRYPTED AND REASSEMBLED
The player reads the MOOV ✓
It looks for frame 30 at byte 45382 ✓
BUT: Bytes 45382 in decrypted stream = garbage
      (because decryption per-chunk corrupted alignment)
```

### The Double Problem

1. **Encryption breaks frame alignment**: When you encrypt each 2MB chunk separately with IV+AuthTag, you add overhead. Reassembling doesn't restore the original byte alignment.

2. **MOOV offsets become invalid**: The MOOV atom references absolute positions that no longer exist in the reassembled stream.

3. **Video player gets lost**: "Go to byte 45382" → gets corrupted frame data → can't decode → shows nothing

---

## Part 3: Solutions (Three Approaches)

### Solution 1: Re-process Video During Upload (RECOMMENDED for your use case)

**What it does**: Convert the original video to "faststart" format before uploading.

**How it works**:
- When a video is uploaded, use FFmpeg to re-encode with `-movflags +faststart`
- This puts the MOOV atom at the **beginning** of the file
- Then split this "web-optimized" video into chunks

**Pros**:
- ✅ MOOV metadata is in first few KB, downloaded immediately
- ✅ Standard MP4, plays on any video player
- ✅ Supports seeking via HTTP range requests
- ✅ Video player works correctly

**Cons**:
- ❌ Re-encoding takes time (1-10 minutes for large files)
- ❌ Server CPU intensive
- ❌ Storage overhead (small)

**Implementation approach**:
```javascript
// In your upload endpoint
const {exec} = require('child_process');
await execAsync(`ffmpeg -i input.mp4 -movflags +faststart output.mp4`);
// Now split output.mp4 into 2MB chunks
```

---

### Solution 2: Use HLS (HTTP Live Streaming)

**What it does**: Breaks video into small segments + creates a playlist manifest.

**Structure**:
```
video.m3u8 (playlist manifest):
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXTINF:10.0,
segment-0.ts
#EXTINF:10.0,
segment-1.ts
#EXT-X-ENDLIST

Plus actual segments:
segment-0.ts (10 seconds of video)
segment-1.ts (10 seconds of video)
...
```

**Pros**:
- ✅ Each segment is independently playable
- ✅ Built for streaming (widely supported)
- ✅ Adaptive bitrate possible
- ✅ Works with all major browsers

**Cons**:
- ❌ More complex to implement
- ❌ Need to create multiple segment files
- ❌ Browser must support HLS (most modern ones do)
- ⚠️ Seeking is segment-based, not frame-accurate

---

### Solution 3: Store Each Chunk as Valid MP4 Fragment

**What it does**: Instead of splitting raw MP4, create fragmented MP4s (fMP4).

**How**:
```
Instead of: One big MOOV + one big MDAT
Create: MOOV + mini-MDAT for chunk 1
        + mini-MDAT for chunk 2
        + mini-MDAT for chunk 3
```

**Pros**:
- ✅ Each chunk is a complete, valid video segment
- ✅ Can play individual chunks
- ✅ Proper metadata per chunk

**Cons**:
- ❌ More complex encoding
- ❌ Fragmented MP4s less widely supported
- ❌ Seeking requires playback of all prior chunks

---

## Part 4: Your Best Path Forward

### Recommended: Solution 1 with Smart Chunking

Here's the complete flow:

```
1. User uploads video.mp4
   ↓
2. Backend: FFmpeg reprocess
   ffmpeg -i video.mp4 -movflags +faststart -c copy output.mp4
   (Takes 30 seconds, no re-encoding, just reordering atoms)
   ↓
3. Split faststart MP4 into 2MB chunks
   Chunk 1: bytes 0-2MB (contains MOOV at beginning!)
   Chunk 2: bytes 2MB-4MB
   ...
   ↓
4. Encrypt each chunk with AES-256-GCM
   Store on Telegram
   ↓
5. Playback: Fetch and decrypt parts → Reassemble → Stream
   Player requests bytes 0-2MB (first chunk)
   → Gets MOOV immediately
   → Can start playing
   → Requests more chunks as needed
```

### Implementation Steps

#### Step 1: Add FFmpeg to your upload process

```javascript
// In processEncryptedUpload() function
const fs = require('fs').promises;
const path = require('path');
const {execSync} = require('child_process');

export async function processEncryptedUpload(
  fileBuffer, 
  masterPassword, 
  folderId, 
  description, 
  tags, 
  fileId, 
  filename
) {
  // 1. Write buffer to temp file
  const tempInputPath = path.join('/tmp', `${fileId}_input.mp4`);
  const tempOutputPath = path.join('/tmp', `${fileId}_optimized.mp4`);
  
  await fs.writeFile(tempInputPath, fileBuffer);
  
  // 2. Re-process with faststart (only if video)
  if (filename.endsWith('.mp4')) {
    try {
      execSync(
        `ffmpeg -i ${tempInputPath} -c copy -movflags +faststart ${tempOutputPath}`,
        { stdio: 'pipe' }
      );
      
      // Read optimized file
      const optimizedBuffer = await fs.readFile(tempOutputPath);
      
      // Derive key and process with optimized buffer
      const key = await deriveEncryptionKey(masterPassword);
      return processEncryptedUploadWithKey(
        optimizedBuffer,
        key,
        folderId,
        filename,
        description,
        tags,
        fileId
      );
    } catch (err) {
      console.warn('FFmpeg faststart failed, using original:', err.message);
      // Fallback to original buffer
    } finally {
      // Cleanup
      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
    }
  }
  
  // Original path if not MP4
  const key = await deriveEncryptionKey(masterPassword);
  return processEncryptedUploadWithKey(
    fileBuffer,
    key,
    folderId,
    filename,
    description,
    tags,
    fileId
  );
}
```

#### Step 2: Update your stream endpoint

Your current stream endpoint is **mostly correct**. The key fix needed:

```javascript
// Add retry logic with exponential backoff
// (you already have this, but improve it)

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT = 5000; // 5 seconds

async function fetchWithRetry(url, retries = 0) {
  try {
    return await fetch(url, { 
      signal: AbortSignal.timeout(INITIAL_TIMEOUT * Math.pow(2, retries))
    });
  } catch (err) {
    if (retries < MAX_RETRIES) {
      const delay = 1000 * Math.pow(2, retries);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, retries + 1);
    }
    throw err;
  }
}
```

---

## Part 5: Testing Your Solution

Once you implement faststart:

```bash
# Check if MOOV is at beginning
ffprobe -show_entries format output.mp4

# Should show: moov atom early in the file
# Before this: should work!
```

Test in browser:
```html
<video width="640" controls>
  <source src="/api/stream?file_id=xxx" type="video/mp4">
</video>
```

Should now:
- ✅ Load quickly
- ✅ Show duration/timeline
- ✅ Play from beginning
- ✅ Support seeking (after faststart)

---

## Part 6: Why Not HLS/DASH Yet?

For your use case:
- HLS requires multiple segment files (more Telegram uploads)
- DASH requires external MPD manifest file
- Both add complexity

**Faststart is the simplest solution** that:
- Requires minimal code changes
- Works with standard MP4 players
- Doesn't require external manifests
- Supports your encryption model

Start with faststart. If you need advanced features later (adaptive bitrate, live streaming), then move to HLS/DASH.

---

## Summary

**Your current issue**: MOOV atom in wrong place + chunk misalignment
**Your solution**: FFmpeg faststart before chunking
**Time to implement**: ~2-3 hours including testing
**Server cost**: ~30 seconds per video for re-processing
**User experience**: Instant playback + seeking support

Ready to implement?
