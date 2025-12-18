# Streaming Implementation - Next Steps

## What We Just Built

✅ **Server-side video optimization** with FFmpeg faststart
✅ **Chunked streaming endpoint** that serves encrypted video
✅ **Browser-side decryption** with Web Crypto API
✅ **VideoPlayer component** with MediaSource API
✅ **FileViewer modal** for file preview

---

## Required Tasks (Before Testing)

### 1. Ensure FFmpeg is Installed on Server
```bash
# Check if FFmpeg is available
which ffmpeg
ffmpeg -version

# If not installed:
# On macOS:
brew install ffmpeg

# On Linux (Ubuntu/Debian):
sudo apt-get install ffmpeg

# On Linux (Fedora):
sudo dnf install ffmpeg
```

### 2. Test File Upload & Streaming

Create a test component to verify the flow:

```jsx
// app/pages/test-streaming.jsx
'use client';

import { useState } from 'react';
import UploadForm from '@/components/UploadForm';
import FileViewer from '@/components/FileViewer';
import { useEncryption } from '@/contexts/EncryptionContext';

export default function TestStreaming() {
  const { unlock, masterPassword } = useEncryption();
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Setup Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="font-semibold text-blue-900 mb-2">1️⃣ Setup Master Password</h2>
        {!masterPassword ? (
          <button
            onClick={() => unlock('test-password-123')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Unlock with Test Password
          </button>
        ) : (
          <p className="text-green-700">✅ Unlocked with master password</p>
        )}
      </div>

      {/* Upload Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-4">2️⃣ Upload Test Video</h2>
        {masterPassword ? (
          <UploadForm
            onFileUploaded={() => {
              // Refresh file list
              console.log('File uploaded, refresh list...');
            }}
          />
        ) : (
          <p className="text-gray-600">Please unlock first</p>
        )}
      </div>

      {/* Streaming Test Section */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h2 className="font-semibold text-gray-900 mb-4">3️⃣ Test Video Streaming</h2>
        
        {/* Mock file for testing */}
        <button
          onClick={() => {
            setSelectedFile({
              id: 'test-file-id',
              original_filename: 'test-video.mp4',
              file_size: 500000000,
              mime_type: 'video/mp4',
              is_encrypted: true
            });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Open Test Video Viewer
        </button>
      </div>

      {selectedFile && (
        <FileViewer file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
}
```

### 3. Add Route Protection to /api/stream

The streaming endpoint currently doesn't check authentication. Add:

```javascript
// app/api/stream/[fileId]/route.js
import { getSession } from '@/lib/auth'; // or your auth method

export async function GET(request, { params }) {
  try {
    // TODO: Add authentication check
    // const session = await getSession();
    // if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // TODO: Check if user owns this file
    // const file = await getFile(params.fileId);
    // if (file.user_id !== session.userId) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    // ... rest of endpoint
  }
}
```

### 4. Error Handling in VideoPlayer

Add retry logic for failed chunk fetches:

```javascript
// In VideoPlayer.jsx, enhance loadRemainingChunks():

const loadRemainingChunks = async (key, startChunk, total, sourceBuffer) => {
  const MAX_RETRIES = 3;
  
  for (let chunkNum = startChunk; chunkNum <= total; chunkNum++) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`/api/stream/${fileId}?chunk=${chunkNum}`);
        // ... load chunk ...
        break; // Success, move to next chunk
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }
    }
    
    if (lastError) {
      console.warn(`Failed to load chunk ${chunkNum} after ${MAX_RETRIES} attempts`);
    }
  }
};
```

---

## Testing Procedure

### Step 1: Start Server
```bash
npm run dev
# Should see "Ready in X ms"
```

### Step 2: Open Browser Console
```javascript
// Check if Web Crypto is available
console.log(crypto.subtle); // Should print: SubtleCrypto object
```

### Step 3: Upload Test Video
1. Go to upload page
2. Unlock with master password
3. Select a test video file (try 10-20MB for quick test)
4. Watch console for FFmpeg optimization messages
5. Should see file marked as "Success" after 30-60 seconds

### Step 4: Verify Database
```bash
# Connect to database
sqlite3 db/files.db

# Check file record
SELECT id, original_filename, file_size FROM files ORDER BY created_at DESC LIMIT 1;

# Check chunks
SELECT part_number, size, iv, auth_tag FROM file_parts WHERE file_id = 'YOUR_FILE_ID';
```

Should see 5-6 records (500-600MB ÷ 2MB per chunk).

### Step 5: Test Streaming
1. Open file viewer
2. Click "Play"
3. Watch console for:
   - "Loading video..." progress
   - Chunk fetch requests
   - Decryption operations
4. Video should start playing within 3-5 seconds
5. Check Network tab:
   - Requests should go to `/api/stream/...`
   - Response should be binary (encrypted)
   - Headers should have `x-iv`, `x-auth-tag`

---

## Expected Behavior

### Upload Phase
```
[UploadForm] User selects video.mp4 (100MB for testing)
[UploadForm] Shows "Uploading..." progress (0-80%)
[Server] FFmpeg optimizes (console: "FFmpeg faststart...")
[Server] Encrypts and chunks
[Server] Sends chunks to Telegram
[UploadForm] Shows "Encrypting..." status
[Server] Returns success after ~30 seconds
[UploadForm] Shows "Completed" ✅
```

### Streaming Phase
```
[FileViewer] User clicks "Play"
[VideoPlayer] Fetches chunk #1
[Server] Returns encrypted chunk + IV + authTag
[VideoPlayer] Decrypts in browser
[VideoPlayer] Appends to MediaSource
[Browser] HTML5 video player renders
[VideoPlayer] Loads chunks 2-5 in background
[Browser] User sees video timeline immediately
[Browser] User can play, pause, seek
```

---

## Debugging Commands

### Check FFmpeg
```bash
# Verify FFmpeg works
ffmpeg -i sample.mp4 -c copy -movflags +faststart output.mp4 -y
# Should create output.mp4 with MOOV at beginning
```

### Check MOOV Position
```bash
# View atoms in MP4
ffprobe -show_entries format output.mp4

# Or with more detail
ffmpeg -i input.mp4 -c copy -movflags +faststart -f null -
```

### Check Server Logs
```bash
# Terminal running "npm run dev"
# Look for messages like:
# "Video optimized: video.mp4 (original: 524288000, optimized: 524199000)"
# "Buffer encryption complete for fileId: abc123"
# "Error sending file to Telegram" (if Telegram fails)
```

### Check Browser Network Tab
1. Open DevTools → Network
2. Filter by XHR
3. Click "Play" on video
4. Should see requests like:
   ```
   GET /api/stream/abc123?chunk=1
   GET /api/stream/abc123?chunk=2
   ...
   ```
5. Each response should be ~2MB binary data

---

## Potential Issues & Solutions

### Issue: "ffmpeg not found"
**Solution:**
```bash
# Install FFmpeg
brew install ffmpeg  # macOS
sudo apt-get install ffmpeg  # Linux
choco install ffmpeg  # Windows
```

### Issue: Video won't decrypt
**Possible causes:**
1. Master password doesn't match (user changed it?)
2. IV/authTag corrupted in database
3. Chunk corrupted from Telegram

**Check:**
```javascript
// In VideoPlayer console
console.log('IV from header:', iv);
console.log('AuthTag from header:', authTag);
console.log('Key derived:', key);
```

### Issue: Video starts but stalls
**Possible causes:**
1. Slow internet connection
2. Slow decryption (check CPU usage)
3. Telegram API slow

**Monitor:**
- Network tab for request times
- CPU usage while decrypting
- Telegram API response times

### Issue: TypeError: "mediaSource is not open"
**Solution:**
```javascript
// In VideoPlayer, ensure mediaSource is open before appending
sourceBuffer.addEventListener('updateend', () => {
  // Safe to append more data here
});
```

---

## Performance Monitoring

Add logging to track performance:

```javascript
// In VideoPlayer.jsx
const startTime = Date.now();

const decryptChunk = async (...) => {
  const t0 = performance.now();
  const decrypted = await crypto.subtle.decrypt(...);
  const t1 = performance.now();
  console.log(`Decryption took ${(t1-t0).toFixed(0)}ms for ${encryptedData.byteLength} bytes`);
  return decrypted;
};

// Should see something like:
// "Decryption took 150ms for 2097152 bytes" (~14MB/s)
```

---

## Final Checklist

- [ ] FFmpeg installed and working
- [ ] Test video uploaded successfully
- [ ] file_parts table has correct chunks
- [ ] IV and authTag stored correctly in DB
- [ ] /api/stream endpoint returns encrypted data
- [ ] VideoPlayer decrypts successfully
- [ ] Video plays without stalling
- [ ] Seeking works (after full video loads)
- [ ] No plaintext video data appears in network requests
- [ ] Error handling works for failed chunks
- [ ] Browser console shows no JS errors

---

## Next Phase (After Testing)

Once streaming works:
1. Add authentication to /api/stream
2. Implement download functionality
3. Add thumbnail generation
4. Build file list/library UI
5. Implement sharing (with access tokens)
