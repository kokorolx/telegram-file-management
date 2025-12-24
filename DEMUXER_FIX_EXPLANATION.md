# Fix for CHUNK_DEMUXER_ERROR_APPEND_FAILED on Seek to Unbuffered Areas

## Problem Statement

When seeking to an unbuffered area in a fragmented MP4 video (e.g., seeking from position 100s to 492s when only chunks 1-4 are buffered), the following error sequence occurs:

1. Chunks 5-22 are fetched and decrypted successfully
2. First append of chunk 5 fails with "SourceBuffer error" before the error event handler even fires
3. Subsequent chunk appends fail with "HTMLMediaElement.error attribute is not null"
4. Video enters unrecoverable error state: `MEDIA_ERR_DECODE (code 3)`
5. Final buffered state shows continuous buffer but video won't play

## Root Cause Analysis

### Fragmented MP4 Structure
FFmpeg fragmentation with `movflags=frag_keyframe+empty_moov+default_base_moof+dash` produces:

```
Chunk 1 (Init Segment):
  - ftyp box (file type)
  - moov box (global metadata, sample tables, duration)

Chunks 2+ (Media Fragments):
  - moof box (Movie Fragment: frame metadata, sample descriptions)
  - mdat box (Media Data: actual compressed video/audio samples)
```

### The Timeline Problem

Each `moof` box contains **relative timestamps** for samples within that fragment:
- Sample 1 in moof at offset 0
- Sample 2 at offset 40ms
- Sample 3 at offset 80ms
- etc.

When building the initial buffer sequentially (chunks 1→2→3→4):
1. Demuxer reads moov (global sample table, duration info)
2. Appends chunk 2: samples at 0ms, 40ms, 80ms → timeline 0-120ms
3. Appends chunk 3: samples at 0ms, 40ms, 80ms → timeline 120-240ms (continuous)
4. Appends chunk 4: samples at 0ms, 40ms, 80ms → timeline 240-360ms (continuous)

When seeking and jumping to chunk 5 with a **gap**:
1. Buffer already has 0-100s (chunks 2-4)
2. Append chunk 5: samples at 0ms, 40ms, 80ms → **WHERE IN TIMELINE?**
3. Demuxer: "Wait, I see samples at 0ms again, but buffer already has samples up to 100s. This breaks the timeline continuity!" 
4. **REJECTED** - demuxer error

### Why Each Append Fails

Without explicit timeline positioning:
- Chunk 5 samples (0-120ms relative) are ambiguous
- Demuxer can't determine if they're:
  - At absolute time 480s (where they should be)
  - At absolute time 0s (where chunk 2 samples are)
  - Somewhere in between

## Solution: SourceBuffer.timestampOffset

The HTML5 MediaSource API provides `SourceBuffer.timestampOffset` to solve exactly this:

```javascript
// Before appending chunk 5 (which has a gap)
sourceBuffer.timestampOffset = 480;  // Absolute timeline position in seconds

// Now append chunk 5
sourceBuffer.appendBuffer(chunk5Data);
// Demuxer interprets samples as:
// 0ms relative → 480s + 0ms = 480s absolute
// 40ms relative → 480s + 40ms = 480.04s absolute
// ... continuity preserved!
```

## Implementation Details

### Chunk-to-Timeline Mapping

With FFmpeg fragmentation and init segment in chunk 1:
- **Chunk 1**: Init segment (no playback timeline)
- **Chunk 2**: First media chunk → timeline starts at 0s
- **Chunk N**: Timeline position = (N - 2) × (duration / totalChunks)

### Gap Detection

A gap exists when:
1. Chunk number > 2 (skipping some media chunks)
2. Buffer is empty OR
3. Chunk's estimated timeline position > end of current buffer

```javascript
const firstChunk = chunksToAppend[0].chunkNum;
if (firstChunk > 2 && isFragmented) {
  const buffered = videoRef.current.buffered;
  const estimatedTime = ((firstChunk / totalChunks) * duration);
  const hasGap = !buffered || buffered.length === 0 || 
                 estimatedTime > buffered.end(buffered.length - 1);
  
  if (hasGap) {
    // Apply offset before appending
  }
}
```

### Offset Application

```javascript
// Apply offset ONCE before appending first gap chunk
if (!offsetApplied && needsOffset && chunkNum > 2) {
  const secondsPerChunk = duration / totalChunks;
  const chunkStartTime = (chunkNum - 2) * secondsPerChunk;
  
  sourceBuffer.timestampOffset = chunkStartTime;
  offsetApplied = true;
}

// Append now works because demuxer knows where samples belong
await appendToSourceBuffer(sourceBuffer, decrypted);

// Reset offset for subsequent contiguous appends
if (offsetApplied) {
  sourceBuffer.timestampOffset = 0;
}
```

## Why This Works

1. **Explicit Timeline**: Each moof's relative samples are offset by the timestampOffset value
2. **Demuxer Alignment**: Samples maintain continuous timeline even with gaps
3. **Single Application**: Offset applies to ALL samples in appended moof/mdat, so only set once per gap
4. **Automatic Adjustment**: Next contiguous chunk doesn't need offset (reset to 0)

## Testing Scenarios

✅ Seek from 100s to 492s (gap > 5 chunks)
✅ Seek to middle of video
✅ Seek to near end
✅ Rapid sequential seeks
✅ Seek backward (smaller gap)

## References

- [MDN: SourceBuffer.timestampOffset](https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer/timestampOffset)
- [Media Source Extensions Spec](https://www.w3.org/TR/media-source-2/)
- [FFmpeg fragmentation flags](https://ffmpeg.org/ffmpeg-formats.html#mp4)

## Related Issues

- Prevents `CHUNK_DEMUXER_ERROR_APPEND_FAILED`
- Prevents `HTMLMediaElement.error` on gap-fill
- Enables proper seek-based on-demand chunk loading
- Maintains compatibility with continuous playback
