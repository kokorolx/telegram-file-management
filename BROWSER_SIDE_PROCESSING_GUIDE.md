# Browser-Side Video Processing & Encryption Guide

## Can We Move This to the Browser?

**Short answer**: Yes, but with caveats. Here's what's feasible:

| Task | Browser | Server | Trade-offs |
|------|---------|--------|-----------|
| **Encryption (AES-256-GCM)** | ✅ Yes | ❌ Keep here | Fully native, Web Crypto API, fast enough |
| **Video faststart (MP4 reprocessing)** | ⚠️ Limited | ✅ Recommended | Requires FFmpeg.wasm, heavy load on browser |
| **Chunking & uploading** | ✅ Yes | - | Browser streaming upload to Telegram |

---

## Part 1: Browser-Side Encryption (Fully Feasible)

### Why Encrypt in Browser?

- ✅ **Privacy**: Encryption happens before upload
- ✅ **Performance**: Web Crypto API is hardware-accelerated
- ✅ **User control**: Shows progress, cancellable
- ✅ **Zero server trust**: Server never sees plaintext or key

### Implementation: Streaming Encryption

Use **Web Crypto API** with **chunked encryption**. For AES-256-GCM:

```javascript
// 1. Generate/derive key from password
async function deriveKeyFromPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  // Derive key using PBKDF2
  const baseKey = await crypto.subtle.importKey(
    'raw',
    data,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(16), // Use consistent salt or store it
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
  
  return key;
}

// 2. Stream-encrypt large file in chunks
async function encryptFileInChunks(file, password, onProgress) {
  const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks
  const key = await deriveKeyFromPassword(password);
  
  let offset = 0;
  const encryptedChunks = [];
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const chunkData = await chunk.arrayBuffer();
    
    // Generate fresh IV for each chunk
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt chunk
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      chunkData
    );
    
    // Store IV + encrypted data together
    const encryptedChunk = {
      iv: iv,
      data: new Uint8Array(encryptedBuffer),
      index: encryptedChunks.length
    };
    
    encryptedChunks.push(encryptedChunk);
    
    offset += CHUNK_SIZE;
    onProgress?.(Math.round((offset / file.size) * 100));
  }
  
  return encryptedChunks;
}

// 3. Upload encrypted chunks
async function uploadEncryptedChunks(encryptedChunks, password) {
  for (const chunk of encryptedChunks) {
    const formData = new FormData();
    
    // Create blob with IV prefix (12 bytes) + encrypted data
    const buffer = new ArrayBuffer(12 + chunk.data.length);
    const view = new Uint8Array(buffer);
    
    view.set(chunk.iv, 0);
    view.set(chunk.data, 12);
    
    formData.append('file', new Blob([buffer]));
    formData.append('is_encrypted', true);
    formData.append('chunk_index', chunk.index);
    formData.append('master_password', password);
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
  }
}
```

### Usage in UploadForm Component

```jsx
// Modify your existing UploadForm
const [isEncrypting, setIsEncrypting] = useState(false);
const [encryptProgress, setEncryptProgress] = useState(0);

const uploadFile = async (fileItem, password) => {
  try {
    setIsEncrypting(true);
    
    // Encrypt in browser
    const encryptedChunks = await encryptFileInChunks(
      fileItem.file,
      password,
      (progress) => setEncryptProgress(progress)
    );
    
    // Upload encrypted chunks
    await uploadEncryptedChunks(encryptedChunks, password);
    
    updateFileStatus(fileItem.id, 'success', 100);
  } catch (err) {
    updateFileStatus(fileItem.id, 'error', 0, err.message);
  } finally {
    setIsEncrypting(false);
  }
};
```

### Server Side (Updated)

Since encryption now happens on client, your server just needs to store:

```javascript
// app/api/upload/route.js - SIMPLIFIED
export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  const chunkIndex = formData.get('chunk_index');
  const isEncrypted = formData.get('is_encrypted') === 'true';
  
  // File already encrypted, no password needed
  // Just validate and store
  
  if (!isEncrypted) {
    return NextResponse.json(
      { error: 'Client-side encryption required' },
      { status: 400 }
    );
  }
  
  // Store encrypted blob directly
  // (First 12 bytes are IV, rest is ciphertext)
  const fileId = uuidv4();
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  
  // No encryption here, just storage
  await storeEncryptedChunk(fileBuffer, fileId, chunkIndex);
  
  return NextResponse.json({ success: true, data: { id: fileId } });
}
```

---

## Part 2: Video Faststart in Browser (Complex)

### Option A: FFmpeg.wasm (Possible but Slow)

FFmpeg.wasm can do `-movflags +faststart` in the browser, but...

**Pros**:
- ✅ No server involvement
- ✅ Shows real-time progress
- ✅ Works offline

**Cons**:
- ❌ **HUGE library**: ~30MB uncompressed, ~8MB gzipped
- ❌ **Very slow**: 25x slower than native FFmpeg (see research)
  - Native: 5.2 seconds to convert 1MB video
  - FFmpeg.wasm: 128 seconds (25x slower)
- ❌ **Memory intensive**: Loads entire file into RAM
- ❌ **File size limit**: ~2GB max per browser limitations
- ❌ **Single-threaded**: Blocks UI during processing

**Use case**: Only for videos < 50MB

### Implementation (If You Choose This)

```javascript
import FFmpeg from '@ffmpeg/ffmpeg';

async function reprocessVideoWithFaststart(file, onProgress) {
  const ffmpeg = FFmpeg.FFmpeg.create();
  
  // Load FFmpeg library (one-time, ~30MB download)
  if (!ffmpeg.isLoaded()) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress?.(Math.round(progress * 100));
    });
    
    await ffmpeg.load();
  }
  
  try {
    // Write file to virtual filesystem
    const data = new Uint8Array(await file.arrayBuffer());
    ffmpeg.FS('writeFile', 'input.mp4', data);
    
    // Run faststart reprocessing
    await ffmpeg.run(
      '-i', 'input.mp4',
      '-c', 'copy',              // No re-encoding!
      '-movflags', '+faststart',
      'output.mp4'
    );
    
    // Read optimized file
    const output = ffmpeg.FS('readFile', 'output.mp4');
    
    // Cleanup
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'output.mp4');
    
    return new File([output], 'optimized.mp4', { type: 'video/mp4' });
    
  } catch (err) {
    console.error('FFmpeg processing failed:', err);
    return file; // Fallback to original
  }
}
```

### Option B: Hybrid (RECOMMENDED)

Do **video processing on server**, **encryption in browser**:

```
User uploads video
  ↓
Browser: Show "Processing video..."
  ↓
Server: FFmpeg -movflags +faststart (30 sec)
  ↓
Server sends back optimized video
  ↓
Browser: Encrypt with Web Crypto (fast, non-blocking)
  ↓
Browser: Upload encrypted chunks to Telegram
```

**Best of both worlds**:
- ✅ Fast video processing
- ✅ Privacy with client-side encryption
- ✅ No blocking on browser
- ✅ Supports large files

---

## Part 3: Recommended Architecture

### Optimal Setup for Your Use Case

```
┌─────────────────────────────────────────────────┐
│              USER'S BROWSER                     │
├─────────────────────────────────────────────────┤
│  1. Select video file                           │
│  2. Request: POST /api/optimize (file to server)│
│                                                 │
│     ↓↓↓ (file sent unencrypted)                 │
└──────────────────┬──────────────────────────────┘
                   │
                   ↓
┌──────────────────────────────────────────────────┐
│             YOUR BACKEND SERVER                 │
├──────────────────────────────────────────────────┤
│  1. Receive raw video                           │
│  2. Run: ffmpeg -i input.mp4 -c copy            │
│          -movflags +faststart output.mp4        │
│  3. Return optimized video to browser           │
│     (or stream back in chunks)                  │
│                                                 │
│     ↓↓↓ (optimized video sent back)             │
└──────────────────┬───────────────────────────────┘
                   │
                   ↓
┌─────────────────────────────────────────────────┐
│              USER'S BROWSER (CONT'D)            │
├─────────────────────────────────────────────────┤
│  3. Receive optimized video                    │
│  4. Encrypt in chunks (Web Crypto API)         │
│     - AES-256-GCM with PBKDF2 key derivation   │
│     - Show progress: encrypting...              │
│  5. Upload encrypted chunks to Telegram         │
│     - Show progress: uploading...               │
│  6. Done!                                       │
│                                                 │
│  Total time visible to user: 2-3 minutes       │
│  (30 sec server + 2-3 min client encrypt/upload)
└─────────────────────────────────────────────────┘
```

---

## Part 4: Implementation Plan (For You)

### Step 1: Add Optimization Endpoint

```javascript
// app/api/optimize/route.js
import { execSync } from 'child_process';
import { randomBytes } = require('crypto');
import { writeFile, unlink } = require('fs').promises;
import { join } = require('path');

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  
  const tempId = randomBytes(8).toString('hex');
  const inputPath = join('/tmp', `${tempId}_input.mp4`);
  const outputPath = join('/tmp', `${tempId}_output.mp4`);
  
  try {
    // Write to temp file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);
    
    // Run faststart
    execSync(
      `ffmpeg -i ${inputPath} -c copy -movflags +faststart ${outputPath}`,
      { stdio: 'pipe', timeout: 300000 } // 5 min timeout
    );
    
    // Return optimized video
    const optimized = await readFile(outputPath);
    
    return new Response(optimized, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'inline'
      }
    });
    
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}
```

### Step 2: Update UploadForm Component

```jsx
const [processingVideo, setProcessingVideo] = useState(false);
const [optimizedFile, setOptimizedFile] = useState(null);

const handlePasswordSubmit = async (password) => {
  const fileItem = pendingFileForUpload;
  
  // Check if video needs optimization
  if (fileItem.file.type.startsWith('video/')) {
    try {
      setProcessingVideo(true);
      
      // Request server to optimize
      const formData = new FormData();
      formData.append('file', fileItem.file);
      
      const response = await fetch('/api/optimize', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const optimizedBuffer = await response.arrayBuffer();
        const optimizedFile = new File(
          [optimizedBuffer],
          fileItem.file.name,
          { type: 'video/mp4' }
        );
        
        setOptimizedFile(optimizedFile);
        fileItem.file = optimizedFile; // Use optimized version
      }
    } catch (err) {
      console.warn('Video optimization failed, using original:', err);
      // Continue with original
    } finally {
      setProcessingVideo(false);
    }
  }
  
  // Now proceed with encryption
  await encryptAndUpload(fileItem, password);
};

const encryptAndUpload = async (fileItem, password) => {
  try {
    updateFileStatus(fileItem.id, 'encrypting', 30);
    
    const encryptedChunks = await encryptFileInChunks(
      fileItem.file,
      password,
      (progress) => updateFileStatus(fileItem.id, 'encrypting', 30 + (progress * 0.5))
    );
    
    updateFileStatus(fileItem.id, 'uploading', 80);
    
    await uploadEncryptedChunks(encryptedChunks, password);
    
    updateFileStatus(fileItem.id, 'success', 100);
  } catch (err) {
    updateFileStatus(fileItem.id, 'error', 0, err.message);
  }
};
```

---

## Part 5: Decision Matrix

Choose based on your constraints:

| Scenario | Solution | Why |
|----------|----------|-----|
| Small videos < 50MB, need 100% privacy | FFmpeg.wasm in browser | Privacy > performance |
| Large videos > 100MB | Hybrid (optimize on server, encrypt in browser) | Speed + privacy balance |
| Maximum privacy, minimum server load | Full browser processing | Accept slow performance |
| Production, user expectations matter | **Hybrid** ← **RECOMMENDED** | Fast, secure, scalable |

---

## Trade-offs Summary

### Full Browser Processing
- ✅ **Pros**: Maximum privacy, no server CPU cost
- ❌ **Cons**: 30MB library load, 25x slower, blocks UI, 2GB limit

### Hybrid (Recommended)
- ✅ **Pros**: Fast optimization, strong encryption, good UX
- ⚠️ **Cons**: Server needs FFmpeg binary, ~30 sec per video

### All Server
- ✅ **Pros**: Fastest, simplest code
- ❌ **Cons**: Server sees plaintext, high CPU cost, less privacy

**My recommendation**: **Go with Hybrid**. It's the best balance for real-world use.
