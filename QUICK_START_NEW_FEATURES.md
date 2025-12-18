# Quick Start: New Features (Auth, Video, Folders)

Fast overview of recently added features and how to use them.

---

## What's New

```
✅ Authentication layer (session-based)
✅ Video & audio upload support (up to 500MB)
✅ Smart file streaming (large files don't load to memory)
✅ Subfolder organization (unlimited nesting)
✅ Intelligent caching (7-30 days depending on type)
```

---

## 1. Using Authentication

### Local Development

**No setup needed** - localhost automatically bypasses authentication.

```bash
npm run dev

# Access without authentication
curl 'http://localhost:3000/api/files'
# ✅ Works
```

### Production / Remote Server

**After setup, authentication is enforced.**

```bash
# Without session → 401 Unauthorized
curl 'https://your-domain.com/api/files'
{
  "success": false,
  "error": "Authentication required. Please log in at /login"
}

# With session cookie → Works
curl 'https://your-domain.com/api/files' \
  -H 'Cookie: session_token=abc123...'
# ✅ Works
```

**For API clients (no browser):**

```bash
# Send token in Authorization header
curl 'https://your-domain.com/api/files' \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN'
```

---

## 2. Upload Videos

### Via Web UI

1. Click "Upload File"
2. Select video (.mp4, .webm, .mkv, etc)
3. Add description and tags
4. Click upload
5. **Automatic:** Detected as video, caches for 7 days

### Via API

```bash
# Upload video (max 500MB)
curl -X POST http://localhost:3000/api/upload \
  -F "file=@video.mp4" \
  -F "description=My tutorial" \
  -F "tags=python,tutorial"

# Response includes file ID for later download
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "original_filename": "video.mp4",
    "mime_type": "video/mp4",
    ...
  }
}
```

### Supported Video Formats

```
MP4, WebM, MKV, AVI, MOV, FLV, WMV, M4V
Max size: 500MB (documents: 100MB)
```

### Supported Audio Formats

```
MP3, WAV, M4A, AAC, FLAC, OGG, WMA, OPUS
Max size: 500MB
```

---

## 3. Video Playback

### In Browser Preview

1. Select video file
2. Click "Preview" button
3. Video opens in modal with controls
4. Features:
   - Play/Pause
   - Seek bar (drag to any position)
   - Fullscreen button
   - Volume control

### Streaming Features

- **Large videos:** Don't load entire file to memory
- **Seeking:** Jump to any position instantly (Range requests)
- **Caching:** Second watch uses browser cache (instant)
- **Bandwidth:** Only download what you watch

### Example

```
Watch 5-minute clip of 1GB video:
- Without streaming: Download full 1GB
- With streaming: Download only 50MB
- Savings: 950MB bandwidth
```

---

## 4. Create Folder Structure

### Root Folder

```bash
curl -X POST http://localhost:3000/api/folders \
  -H 'Content-Type: application/json' \
  -d '{"name":"Videos"}'

# Response:
{
  "success": true,
  "data": {
    "id": "folder-uuid",
    "name": "Videos",
    "parent_id": null
  }
}
```

### Subfolder (Inside another folder)

```bash
curl -X POST http://localhost:3000/api/folders \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"Tutorials",
    "parent_id":"folder-uuid"
  }'

# Creates: Videos > Tutorials
```

### Multiple Levels

```bash
# Videos > Tutorials > Python
# 1. Create Videos folder
VIDEOS_ID=$(...)

# 2. Create Tutorials inside Videos
TUTORIALS_ID=$(...)

# 3. Create Python inside Tutorials
PYTHON_ID=$(...)
```

---

## 5. Upload to Folders

### Upload to Subfolder

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@python_tutorial.mp4" \
  -F "folder_id=python-folder-uuid"

# File goes into Videos > Tutorials > Python
```

### Upload to Root

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@my_file.pdf"
# No folder_id = root level
```

---

## 6. Browse Folders

### List Root Folders

```bash
curl 'http://localhost:3000/api/folders'

# Response:
{
  "success": true,
  "data": [
    {"id": "...", "name": "Videos"},
    {"id": "...", "name": "Photos"},
    {"id": "...", "name": "Documents"}
  ]
}
```

### List Subfolders

```bash
curl 'http://localhost:3000/api/folders?parent_id=videos-uuid'

# Response:
{
  "success": true,
  "data": [
    {"id": "...", "name": "Tutorials", "parent_id": "videos-uuid"},
    {"id": "...", "name": "Personal", "parent_id": "videos-uuid"}
  ]
}
```

### Get Files in Folder

```bash
curl 'http://localhost:3000/api/files?folder_id=python-uuid'

# Response:
{
  "success": true,
  "data": [
    {"id": "...", "original_filename": "intro.mp4"},
    {"id": "...", "original_filename": "loops.mp4"}
  ]
}
```

---

## 7. Caching (Automatic)

### Cache Duration

```
Images (jpg, png, gif) → 30 days
Videos (mp4, webm) → 7 days
Audio (mp3, wav) → 7 days
Documents → 1 day
```

### How It Works

```
1st download: Downloads from Telegram
2nd download (same file): Loads from browser cache
  → Instant (no server request)
```

### Example

```
Download vacation photos (15MB)
Close browser and reopen next week
View photos again
Result: Instant, 0 bandwidth used
```

### Clear Cache

```bash
# Hard refresh
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R

# Or: DevTools → Application → Clear storage
```

---

## 8. Complete Workflow

### Step 1: Organize with Folders

```bash
# Create structure
VIDEOS=$(curl -X POST ... {"name":"Videos"} | jq -r '.data.id')
PYTHON=$(curl -X POST ... {"name":"Python","parent_id":"$VIDEOS"} | jq -r '.data.id')
```

### Step 2: Upload Videos

```bash
# Upload to Python folder
curl -X POST http://localhost:3000/api/upload \
  -F "file=@lesson1.mp4" \
  -F "description=Python Basics" \
  -F "folder_id=$PYTHON"
```

### Step 3: View in Browser

1. Open http://localhost:3000
2. Navigate to Videos > Python
3. Click video to preview
4. Video plays with streaming support
5. **On second view:** Loads from cache instantly

### Step 4: Download via API

```bash
# Get file ID from step 2
curl 'http://localhost:3000/api/download?file_id=<file-id>' \
  -o downloaded_video.mp4

# Large files stream to disk efficiently
```

---

## Common Tasks

### Task: Organize Photo Library

```bash
# Create year folders
2024=$(curl -X POST ... {"name":"2024"} | jq -r '.data.id')
VACATION=$(curl -X POST ... {"name":"Vacation","parent_id":"$2024"} | jq -r '.data.id')

# Upload photos
for photo in vacation/*.jpg; do
  curl -X POST http://localhost:3000/api/upload \
    -F "file=@$photo" \
    -F "folder_id=$VACATION"
done

# Browser shows:
# 2024 > Vacation > [all photos]
```

### Task: Archive Old Files

```bash
# Create archive folder
ARCHIVE=$(curl -X POST ... {"name":"Archive"} | jq -r '.data.id')

# Move files via API (update folder_id)
curl -X PUT http://localhost:3000/api/files/<file-id> \
  -H 'Content-Type: application/json' \
  -d '{"folder_id":"'$ARCHIVE'"}'
```

### Task: Watch Video & Resume

```bash
# Download and stream video
curl 'http://localhost:3000/api/download?file_id=...' \
  -o my_video.mp4

# Browser plays with:
# - Instant start (no full download required)
# - Seek to any position (Range requests)
# - Cache for 7 days (second watch is instant)
```

---

## Testing

### Test 1: Verify Authentication

```bash
# Local (should work without auth)
curl 'http://localhost:3000/api/files'
# ✅ Returns files

# Remote (should fail without auth)
curl 'https://your-domain.com/api/files'
# ❌ 401 Unauthorized
```

### Test 2: Upload Video

```bash
# Create test video
echo "test" | ffmpeg -f lavfi -i color=c=blue:s=320x240:d=1 test.mp4

# Upload
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test.mp4"
# ✅ Should succeed
```

### Test 3: Stream Large File

```bash
# Download returns stream headers
curl -I 'http://localhost:3000/api/download?file_id=...'

# Should show:
# Accept-Ranges: bytes ✅
# Cache-Control: public, max-age=604800 ✅
```

---

## Troubleshooting

### Video Won't Play

**Check file format:**
```bash
ffmpeg -i video.mkv -c:v libx264 -c:a aac output.mp4
# Convert to MP4
```

### Can't Find File After Upload

**Check folder:**
```bash
# Get folder ID
curl 'http://localhost:3000/api/folders'

# Get files in folder
curl 'http://localhost:3000/api/files?folder_id=<id>'
```

### Cache Not Working

**Verify headers:**
```bash
curl -I 'http://localhost:3000/api/download?file_id=...'

# Should show:
# Cache-Control: public, max-age=...
```

**Clear cache:**
```
DevTools → Application → Storage → Clear all
Hard refresh (Cmd+Shift+R)
```

### Authentication Error

**On localhost:**
```bash
# Should not require auth
curl 'http://localhost:3000/api/files'
# ✅ Works
```

**On remote:**
```bash
# Add session token
curl 'https://domain.com/api/files' \
  -H 'Authorization: Bearer <token>'
```

---

## Documentation

For detailed information:

1. **AUTHORIZATION.md** - Auth setup and methods
2. **VIDEO_STREAMING.md** - Video upload, codecs, HLS
3. **SUBFOLDERS.md** - Folder management details
4. **CACHING.md** - Browser caching strategy
5. **IMPLEMENTATION_SUMMARY.md** - What was added

---

## What's Still Optional

Not yet implemented (but can be added):

- [ ] Password-based login UI
- [ ] HLS transcoding (for >500MB videos)
- [ ] Video thumbnails on upload
- [ ] Folder sharing with time-limited links
- [ ] Full-text search
- [ ] File versioning

---

## Next Steps

1. ✅ Run `npm run dev`
2. ✅ Create folders at http://localhost:3000
3. ✅ Upload videos/audio files
4. ✅ Preview in browser
5. ✅ Check AUTHORIZATION.md for production setup

---

**Ready to use!** Start uploading videos and organizing with folders.
