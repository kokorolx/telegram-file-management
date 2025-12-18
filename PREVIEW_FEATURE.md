# Image & Video Preview Feature

View media files directly in the app without downloading.

---

## Features

✅ **Image Preview** - View PNG, JPG, GIF, WebP and more  
✅ **Video Preview** - Play MP4, WebM, and other video formats  
✅ **Audio Preview** - Play MP3, WAV, and audio files  
✅ **Full-Screen Modal** - Distraction-free viewing  
✅ **File Details** - Description and tags in preview modal  

---

## How It Works

### Preview Button

For images, videos, and audio files, each file card shows a **Preview button**:

```
[👁️ Preview] [⬇️ Download] [🗑️ Delete]
```

Click **Preview** to open the media in a modal.

### Preview Modal

The preview modal displays:
- File name and size
- Media content (image, video, or audio player)
- File description (if available)
- Tags (if available)
- Download and close buttons

### Supported Formats

#### Images
- PNG, JPEG, JPG, GIF, WebP, SVG, BMP, TIFF

#### Video
- MP4, WebM, OGG, MOV, AVI

#### Audio
- MP3, WAV, OGG, M4A, FLAC

#### Other Files
- Shows "Preview not available" with download option

---

## Technical Details

### Components

#### PreviewModal.jsx
Modal component that:
- Fetches file from Telegram API
- Displays appropriate media player
- Shows file metadata (description, tags)
- Provides download and close actions

#### FileCard.jsx Updates
- Detects previewable file types by MIME type
- Shows preview button only for media files
- Opens modal on preview click
- Manages preview state

### File Type Detection

Detected by MIME type:
```
isImage = mime_type?.startsWith('image/')
isVideo = mime_type?.startsWith('video/')
isAudio = mime_type?.startsWith('audio/')
```

### Loading & Error Handling

Preview modal:
- Shows loading spinner while fetching
- Displays error with retry button
- Falls back to download option for unsupported types
- Properly cleans up blob URLs after use

---

## User Experience

### Workflow
1. Upload image/video/audio file
2. File appears in file list
3. Click "Preview" button on the card
4. Modal opens with media player
5. View description and tags
6. Download or close

### Keyboard Shortcuts
- `Esc` - Close preview modal (standard)
- `Click X` - Close preview modal

---

## Browser Support

Works in all modern browsers:
- ✅ Chrome/Chromium
- ✅ Firefox
- ✅ Safari
- ✅ Edge

Audio/Video codecs depend on browser support.

---

## Performance

### Optimizations
- Media loaded only when preview clicked
- Blob URLs created and cleaned up properly
- No auto-play of audio/video
- Images scaled to fit screen

### File Size Limits
Same as upload limits (100MB):
- Large videos may take time to load
- Network speed affects preview load time

---

## Future Enhancements

Possible additions:
- [ ] Thumbnail previews in file list
- [ ] Carousel for multiple images
- [ ] Transcript display for audio
- [ ] PDF preview
- [ ] Code syntax highlighting
- [ ] Image optimization (lazy loading)
- [ ] Video seeking progress
- [ ] Zoom controls for images

---

## Troubleshooting

### Preview shows "Failed to load"

**Problem:** Network or API error.

**Solutions:**
1. Click **Retry** button in preview
2. Check internet connection
3. Verify file wasn't deleted from Telegram

### Video/Audio won't play

**Problem:** Browser or codec support.

**Solutions:**
1. Try different browser
2. Download and use media player
3. Check file format is supported

### Preview button doesn't appear

**Problem:** File type not detected as media.

**Solutions:**
1. Verify file MIME type is correct
2. Use "Download" instead
3. Check file extension is correct (e.g., `.mp4` for video)

---

## How to Add to Your App

The preview feature is automatically included in:
- FileCard component
- PreviewModal component

Just upload an image, video, or audio file and click "Preview"!

---

**Status:** Fully functional  
**Last Updated:** December 2025
