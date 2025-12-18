# Video Streaming & Upload Guide

Support for uploading and streaming videos with intelligent caching and streaming.

---

## Video Upload

### Supported Formats

| Format | Extension | Max Size | Use Case |
|--------|-----------|----------|----------|
| **MP4** | .mp4 | 500MB | Most compatible, recommended |
| **WebM** | .webm | 500MB | Modern browsers, smaller files |
| **Matroska** | .mkv | 500MB | High quality, multiple streams |
| **AVI** | .avi | 500MB | Legacy format |
| **MOV** | .mov | 500MB | Apple/QuickTime |
| **FLV** | .flv | 500MB | Flash/legacy |
| **WMV** | .wmv | 500MB | Windows Media |

### Upload Requirements

```
- File size: Max 500MB (videos), 100MB (documents), 100MB (images)
- Format: MP4 recommended for maximum compatibility
- Codecs: H.264 video, AAC audio (for MP4)
- Frame rate: 24-60 FPS
- Resolution: Any (will be scaled for thumbnails)
```

### Upload Example

**Via API:**
```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@video.mp4" \
  -F "description=My video" \
  -F "tags=video,tutorial" \
  -F "folder_id=optional-folder-id"
```

**Via Web UI:**
1. Click "Upload File"
2. Select video file (will auto-detect as video)
3. Add description and tags
4. Select folder (optional)
5. Click "Upload"

---

## Video Playback & Streaming

### How Streaming Works

1. **Initial Request**
   - Browser requests video from `/api/download?file_id=abc123`
   - File is fetched from Telegram
   - Stream is returned to browser

2. **Video Player**
   - Browser uses native `<video>` tag
   - HTML5 video player handles streaming
   - Video plays while downloading (progressive download)

3. **Seeking in Video**
   - Browser sends HTTP Range request: `Range: bytes=100000-200000`
   - Server returns only requested bytes
   - **No need to download full video to seek**

4. **Caching**
   - Video segments cached in browser (7 days)
   - Second watch uses cache instantly
   - ETag prevents re-downloading unchanged file

### Large File Handling

**For files >10MB:**
- Downloaded as stream (not loaded into memory)
- Lower memory usage
- Immediate playback starts
- Seek support via Range requests

**For files <10MB:**
- Downloaded into memory (compatibility)
- Instant full load
- Better for slower connections

---

## Video Preview in Browser

### Supported in Preview Modal

The app includes a built-in video player:

1. Click file in list
2. Click **Preview** button
3. Video opens in modal
4. Controls:
   - Play/Pause
   - Seek bar (drag to position)
   - Volume control
   - Fullscreen button

### Video Controls Included

```
- Play/Pause button
- Progress bar with timeline
- Current time / Duration
- Volume slider
- Fullscreen button
- Buffering indicator
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Play/Pause |
| → | Seek forward 5s |
| ← | Seek backward 5s |
| F | Fullscreen |
| M | Mute |
| ↑ | Volume up |
| ↓ | Volume down |

---

## Advanced Video Setup (Optional)

### HLS Streaming (For Very Large Videos)

For videos larger than 500MB, enable HLS (HTTP Live Streaming):

1. **Install dependencies:**
   ```bash
   npm install hls.js
   ```

2. **Create HLS conversion endpoint** (requires ffmpeg):
   ```bash
   # Server-side conversion from MP4 to HLS
   ffmpeg -i input.mp4 -c:v libx264 -c:a aac \
     -f hls -hls_time 10 -hls_list_size 0 output.m3u8
   ```

3. **Update PreviewModal.jsx:**
   ```javascript
   import Hls from 'hls.js';
   
   if (file.mime_type === 'application/x-mpegURL') {
     const hls = new Hls();
     hls.loadSource(blobUrl);
     hls.attachMedia(videoElement);
     hls.on(Hls.Events.MANIFEST_PARSED, () => {
       videoElement.play();
     });
   }
   ```

**Current Status:** Not enabled (standard streaming sufficient)

### DASH Streaming (Advanced)

Similar to HLS but for DASH format (MPEG-DASH):

```bash
npm install dashjs
```

**Current Status:** Not enabled (optional for enterprise)

---

## Audio Upload & Playback

### Supported Audio Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| MP3 | .mp3 | Most compatible |
| WAV | .wav | Lossless, large files |
| M4A | .m4a | Apple/AAC |
| AAC | .aac | Modern, efficient |
| FLAC | .flac | Lossless |

### Audio Playback

- Same as video (plays in `<audio>` tag)
- Caching: 7 days
- Streaming: Same range request support
- Controls: Identical to video player

---

## Bandwidth Optimization

### Before Streaming
```
Watch 5 minutes of 1GB video:
- Must download entire 1GB (or skip parts)
- Takes 5+ minutes on slow connection
- Wastes bandwidth
```

### With Streaming
```
Watch 5 minutes of 1GB video:
- Downloads only 50MB (5 minutes worth)
- Starts playing immediately
- Can skip ahead (downloads only needed part)
- Smart buffering ahead (buffers next 30 seconds)
```

### Example: 500MB Video on 1Mbps Connection

**Without Streaming:**
- Would take ~65 minutes to download
- Must complete before watching

**With Streaming:**
- Starts playing in 10 seconds
- Watch at normal speed
- Stream keeps pace with playback

---

## Storage Considerations

### Telegram Storage Limits

Telegram Bot API doesn't have per-file limits, but:

- **Max API calls:** 30 requests per second
- **File size:** Telegram supports up to 2GB
- **Storage:** Unlimited (files stored on Telegram servers)
- **Retention:** Files stay as long as bot can access them

### Your Database Storage

PostgreSQL stores metadata only:

```
Per video file metadata: ~500 bytes
1000 videos = ~500KB (negligible)
```

### Browser Cache

```
Videos cached locally in browser:
- Chrome/Firefox: ~10GB total quota
- Safari: ~50-500MB
- Cleared after 7 days (video cache duration)
```

---

## Troubleshooting Video Issues

### Problem: Video Won't Play

**Cause 1: Unsupported format**
```
Solution: Convert to MP4
ffmpeg -i video.mkv -c:v libx264 -c:a aac output.mp4
```

**Cause 2: Large file timeout**
```
Solution: Check server timeout in next.config.js
Increase bodyParser timeout if needed
```

**Cause 3: Browser codec not supported**
```
Solution: Use video format detection
Try different format (MP4 usually works everywhere)
```

### Problem: Playback Stutters

**Cause: Buffer too small or slow connection**
```
Solution:
1. Pause video, let it buffer
2. Check internet speed
3. Try at lower resolution file
```

### Problem: Can't Seek in Video

**Cause: Server doesn't support Range requests**
```
Solution: Already enabled in download API
Check header: Accept-Ranges: bytes
Should show in DevTools Network tab
```

### Problem: Video Takes Too Long to Load

**Cause: Large file, slow connection**
```
Solutions:
1. Check network speed (DevTools Network)
2. Wait for initial buffer (first 30 seconds)
3. Compress video with ffmpeg
4. Upload smaller clips instead
```

---

## Performance Metrics

### Video Playback Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Initial load | <3s | From start of stream |
| Seek response | <1s | Jump to any point |
| Buffering | <2s | At 1Mbps connection |
| Memory usage | <100MB | For streaming video |

### Network Usage

| Action | Data | Time (1Mbps) |
|--------|------|---|
| Load 5 min video | 50MB | 7 min download |
| Play 5 min video | 50MB | 5 min realtime |
| Seek in video | 10KB | <100ms |

---

## Server Configuration

### Next.js Config for Video

File: `next.config.js`

```javascript
export default {
  // Enable streaming responses
  experimental: {
    // Allow large responses
    esmExternals: true,
  },
  // Timeout settings
  onDemandEntries: {
    maxInactiveAge: 30 * 1000,
    pagesBufferLength: 5,
  },
};
```

### API Timeout Settings

For long video downloads, you may need to adjust timeouts:

```javascript
// In route.js
export const maxDuration = 300; // 5 minutes max for download
```

---

## Database Schema

### Files Table

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  folder_id TEXT,
  telegram_file_id TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT,
  mime_type TEXT,              -- e.g., video/mp4, audio/mpeg
  uploaded_at TIMESTAMP,
  description TEXT,
  tags TEXT
);
```

The MIME type field automatically categorizes files:
- `video/*` - Videos (mp4, webm, mkv, etc)
- `audio/*` - Audio (mp3, wav, flac, etc)
- `image/*` - Images
- Others - Documents, archives, etc

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/upload` | POST | Upload video/audio file |
| `/api/download?file_id=abc` | GET | Stream video/audio |
| `/api/files` | GET | List all files |
| `/api/folders` | GET | List folders |
| `/api/folders?parent_id=abc` | GET | List subfolders |

---

## Best Practices

### Uploading Videos

1. **Use MP4 format** - Best compatibility
   ```bash
   ffmpeg -i input.mkv -c:v libx264 -c:a aac -preset fast output.mp4
   ```

2. **Optimize file size** - Smaller = faster upload
   ```bash
   ffmpeg -i input.mp4 -crf 28 -preset fast optimized.mp4
   ```

3. **Add metadata** - Help find videos later
   ```
   Description: "Tutorial on X"
   Tags: "tutorial, educational, 2024"
   ```

### Watching Videos

1. **Use fullscreen** - Better viewing experience
2. **Allow buffering** - Better playback quality
3. **Check connection** - If stuttering, try lower bitrate file
4. **Use Chrome/Firefox** - Best codec support

---

## Future Enhancements

- [ ] Video thumbnail generation on upload
- [ ] HLS/DASH conversion for very large files (>1GB)
- [ ] Resume broken uploads
- [ ] Bitrate detection and adaptive quality
- [ ] Subtitle support (.srt, .vtt)
- [ ] Video transcoding queue
- [ ] DRM/encryption for sensitive videos
- [ ] Live streaming support

---

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| MP4 video upload | ✅ Enabled | Up to 500MB |
| WebM video upload | ✅ Enabled | Up to 500MB |
| Audio upload (MP3, WAV) | ✅ Enabled | Up to 500MB |
| Stream to browser | ✅ Enabled | HTTP Range requests |
| Video preview | ✅ Enabled | Built-in player |
| Caching | ✅ Enabled | 7 days for video |
| HLS streaming | ❌ Optional | For very large files |
| Transcoding | ❌ Not supported | Use ffmpeg locally |

---

**Last Updated:** December 2025
