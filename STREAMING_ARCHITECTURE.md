# Video Streaming Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────┐         ┌──────────────────────────────────┐  │
│  │  UploadForm.jsx      │         │    FileViewer.jsx                │  │
│  ├──────────────────────┤         ├──────────────────────────────────┤  │
│  │ • File selection     │         │ • Shows file details             │  │
│  │ • Drag & drop        │         │ • Renders VideoPlayer or preview │  │
│  │ • Password prompt    │         │ • Modal UI                       │  │
│  │ • Progress tracking  │         │ • File metadata display          │  │
│  └──────────────────────┘         └──────────────────────────────────┘  │
│           │ Upload                         │                             │
│           │ POST /api/upload               │ User clicks Play             │
│           ▼                                ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │             VideoPlayer.jsx (NEW)                                │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │                                                                   │   │
│  │ ┌─ Master Password Unlock ─────────────────────────────────────┐ │   │
│  │ │ • Prompt for master password                                 │ │   │
│  │ │ • Derive encryption key: PBKDF2(password, salt, 100k)       │ │   │
│  │ │ • Store in memory (not localStorage)                        │ │   │
│  │ └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │ ┌─ Chunk Fetching & Decryption ────────────────────────────────┐ │   │
│  │ │ 1. fetch(/api/stream/fileId?chunk=1)                        │ │   │
│  │ │ 2. Response headers contain:                                 │ │   │
│  │ │    - x-iv (12 bytes, hex-encoded)                           │ │   │
│  │ │    - x-auth-tag (16 bytes, hex-encoded)                     │ │   │
│  │ │    - x-chunk-number, x-total-chunks                         │ │   │
│  │ │ 3. Body: encrypted chunk (binary)                           │ │   │
│  │ │ 4. crypto.subtle.decrypt(                                   │ │   │
│  │ │      AES-GCM,                                               │ │   │
│  │ │      key,                                                   │ │   │
│  │ │      encrypted,                                             │ │   │
│  │ │      iv                                                     │ │   │
│  │ │    )                                                         │ │   │
│  │ │ 5. Return decrypted chunk (plaintext video data)            │ │   │
│  │ └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │ ┌─ MediaSource API ─────────────────────────────────────────────┐ │   │
│  │ │ const mediaSource = new MediaSource()                        │ │   │
│  │ │ video.src = URL.createObjectURL(mediaSource)                 │ │   │
│  │ │ const sourceBuffer = mediaSource.addSourceBuffer(            │ │   │
│  │ │   'video/mp4; codecs="avc1.42E01E"'                         │ │   │
│  │ │ )                                                             │ │   │
│  │ │ sourceBuffer.appendBuffer(decryptedChunk)                    │ │   │
│  │ └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │ ┌─ HTML5 Video Player ──────────────────────────────────────────┐ │   │
│  │ │ <video ref={videoRef} controls />                            │ │   │
│  │ │ • Plays from MediaSource                                     │ │   │
│  │ │ • User controls: play, pause, seek, volume                  │ │   │
│  │ │ • Timeline shows duration (from MOOV atom)                  │ │   │
│  │ │ • Buffered chunks shown in gray on timeline                 │ │   │
│  │ └──────────────────────────────────────────────────────────────┘ │   │
│  │                                                                   │   │
│  │ Background chunk loading (chunks 2-N):                           │   │
│  │ • Load remaining chunks in parallel                             │   │
│  │ • Same decrypt process                                          │   │
│  │ • Append to sourceBuffer                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│              Web Crypto API                                              │
│              ┌─────────────────────────────────────────────────┐         │
│              │ crypto.subtle.deriveKey() - PBKDF2            │         │
│              │ crypto.subtle.decrypt() - AES-256-GCM         │         │
│              │ crypto.getRandomValues() - RNG                │         │
│              │ (Hardware accelerated when available)          │         │
│              └─────────────────────────────────────────────────┘         │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                      HTTP/HTTPS   │ Encrypted chunks only
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         YOUR BACKEND SERVER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ POST /api/upload (Upload Handler)                                │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ 1. Receive FormData with raw video file                         │  │
│  │ 2. Validate file (size, type)                                   │  │
│  │ 3. Read entire file into Buffer (async)                         │  │
│  │ 4. Call processEncryptedUpload()                                │  │
│  │    ↓                                                             │  │
│  │    ┌─ FFmpeg Optimization (NEW) ────────────────────────────┐  │  │
│  │    │ if filename ends with .mp4 or .mov:                   │  │  │
│  │    │   1. Create temp directory                            │  │  │
│  │    │   2. Write buffer to /tmp/input.mp4                   │  │  │
│  │    │   3. execSync('ffmpeg -i input.mp4 -c copy            │  │  │
│  │    │               -movflags +faststart output.mp4')        │  │  │
│  │    │   4. Read optimized file from /tmp/output.mp4          │  │  │
│  │    │   5. Delete temp files                                 │  │  │
│  │    │   6. Return optimized buffer                           │  │  │
│  │    └──────────────────────────────────────────────────────┘  │  │
│  │    ↓                                                             │  │
│  │    ┌─ Encryption & Chunking ──────────────────────────────────┐  │  │
│  │    │ 1. Derive key: deriveEncryptionKey(masterPassword)       │  │  │
│  │    │ 2. Split buffer into 2MB chunks                          │  │  │
│  │    │ 3. For each chunk:                                       │  │  │
│  │    │    a. Generate random IV (12 bytes)                      │  │  │
│  │    │    b. Encrypt with AES-256-GCM                          │  │  │
│  │    │    c. Get authTag from cipher                           │  │  │
│  │    │    d. Send encrypted chunk to Telegram                  │  │  │
│  │    │    e. Get tgFileId from Telegram response               │  │  │
│  │    │    f. Save metadata: INSERT file_parts(                 │  │  │
│  │    │       id, file_id, telegram_file_id,                   │  │  │
│  │    │       part_number, size, iv, auth_tag)                │  │  │
│  │    └──────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                 ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ GET /api/stream/[fileId] (Streaming Endpoint - NEW)             │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ Query params: ?chunk=1 (chunk number)                           │  │
│  │                                                                   │  │
│  │ 1. Get file metadata: SELECT * FROM files WHERE id = ?         │  │
│  │ 2. Get all chunks: SELECT * FROM file_parts WHERE file_id = ? │  │
│  │ 3. Validate chunk number                                        │  │
│  │ 4. Get requested part from database                            │  │
│  │ 5. Get Telegram download URL: getFileDownloadUrl()            │  │
│  │ 6. Fetch encrypted chunk from Telegram API                     │  │
│  │ 7. Return HTTP response:                                        │  │
│  │    Headers:                                                      │  │
│  │      x-chunk-number: 1                                          │  │
│  │      x-total-chunks: 10                                         │  │
│  │      x-iv: "a1b2c3d4e5f6g7h8i9j0k1l2"  (24 hex chars)         │  │
│  │      x-auth-tag: "m2n3o4p5q6r7s8t9u0v1w2x3"  (32 hex)         │  │
│  │      x-file-name: "video.mp4"                                  │  │
│  │      x-file-size: "524288000"                                  │  │
│  │    Body: [encrypted chunk bytes]                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                 ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Database Layer                                                    │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │                                                                   │  │
│  │ TABLE files:                                                      │  │
│  │ ┌────────────┬──────────────┬──────────┬──────────────────────┐ │  │
│  │ │ id         │ original_... │ file_... │ is_encrypted         │ │  │
│  │ ├────────────┼──────────────┼──────────┼──────────────────────┤ │  │
│  │ │ abc123     │ video.mp4    │ 524288KB │ true                 │ │  │
│  │ └────────────┴──────────────┴──────────┴──────────────────────┘ │  │
│  │                                                                   │  │
│  │ TABLE file_parts:                                                │  │
│  │ ┌──────┬────────┬──────────────┬──────┬────┬────────┬───────────┐│  │
│  │ │ id   │ file_id│ telegram_... │ part │... │ iv     │ auth_tag  ││  │
│  │ ├──────┼────────┼──────────────┼──────┼────┼────────┼───────────┤│  │
│  │ │ 1    │ abc123 │ AgACAgIAAxk  │ 1    │... │ a1b2c3 │ m2n3o4p5q ││  │
│  │ │ 2    │ abc123 │ AgACAgIAAxm  │ 2    │... │ d4e5f6 │ r7s8t9u0v ││  │
│  │ │ ...  │ ...    │ ...          │ ...  │... │ ...    │ ...       ││  │
│  │ │ 10   │ abc123 │ AgACAgIAAx5  │ 10   │... │ x1y2z3 │ v9w0x1y2z ││  │
│  │ └──────┴────────┴──────────────┴──────┴────┴────────┴───────────┘│  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ Encryption Helper Functions (lib/authService.js)                 │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │ • deriveEncryptionKey(password)                                  │  │
│  │   → Uses PBKDF2 with 100k iterations                            │  │
│  │   → Returns 32-byte key for AES-256                             │  │
│  │                                                                   │  │
│  │ • encryptBuffer(buffer, key)                                    │  │
│  │   → Generates random 12-byte IV                                 │  │
│  │   → Returns {encrypted, iv, authTag}                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
                                  │
                    HTTPS (TLS/SSL encrypted)
                    Telegram API calls
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT API SERVICE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  POST https://api.telegram.org/botXXX:YYY/sendDocument                 │
│  • Upload encrypted chunk (2MB binary blob)                             │
│  • Telegram stores file permanently                                     │
│  • Returns file_id for retrieval                                        │
│                                                                           │
│  GET https://api.telegram.org/botXXX:YYY/getFile?file_id=AgACAgIA...   │
│  • Get download URL for encrypted chunk                                 │
│  • URL valid for 1 hour                                                 │
│  • Fetch via https://api.telegram.org/file/botXXX:YYY/...             │
│                                                                           │
│  Storage:                                                                │
│  • Each chunk stored as separate file                                   │
│  • Telegram file IDs never change                                       │
│  • Deletion not supported by Telegram API (stays forever)              │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Timeline

### Phase 1: Upload (30-60 seconds)

```
T+0s:   User selects video.mp4 (500MB)
        ↓
T+1s:   User enters master password
        ↓
T+2s:   POST /api/upload with video
        Server receives FormData
        ↓
T+3s:   Server validates file
        ↓
T+4s:   Server reads 500MB into Buffer
        ↓
T+5s:   FFmpeg starts: ffmpeg -i input.mp4 -c copy -movflags +faststart output.mp4
        (CPU intensive, ~1-2 seconds per 100MB)
        ↓
T+35s:  FFmpeg completes, output.mp4 ~500MB
        ↓
T+36s:  Server derives key from password: PBKDF2(password, salt, 100k)
        ↓
T+37s:  Server splits into 10 chunks (2MB each)
        ↓
T+38s:  For each chunk (parallel or sequential):
        - Generate IV (12 bytes random)
        - Encrypt with AES-256-GCM
        - Get authTag from cipher
        - Send to Telegram API
        - Save metadata: IV, authTag, telegram_file_id to database
        ↓
T+58s:  All chunks uploaded to Telegram
        ↓
T+59s:  Server returns { success: true, fileId: "abc123" }
        ↓
T+60s:  Client shows "Upload completed ✅"
        File is now stored and ready to stream
```

### Phase 2: Streaming (Initial Load: 3-5 seconds)

```
User clicks "Play" button
↓
T+0s:   Component prompts: "Enter master password to unlock"
        User enters password (same one from upload)
        ↓
T+1s:   Browser: PBKDF2(password, salt, 100k) → key
        (This key must match the one used during upload!)
        ↓
T+2s:   Browser: GET /api/stream/abc123?chunk=1
        ↓
T+3s:   Server: SELECT * FROM file_parts WHERE file_id = 'abc123' AND part_number = 1
        Server: Fetch Telegram download URL
        Server: Download encrypted chunk from Telegram
        ↓
T+4s:   Server returns encrypted chunk + IV + authTag in headers
        ↓
T+5s:   Browser: crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: hexToArrayBuffer(iv) },
          key,
          encryptedChunk
        )
        ↓
T+5.5s: Browser receives decrypted chunk (2MB plaintext video)
        ↓
T+6s:   Browser: mediaSource.sourceBuffer.appendBuffer(decrypted)
        ↓
T+6.5s: HTML5 video player reads MOOV metadata (at beginning because of faststart)
        Knows: duration, codec, frame rate, etc.
        Can render timeline, show duration "01:23:45"
        ↓
T+7s:   User sees video timeline and play button
        Browser starts playing from beginning
        ↓
        Meanwhile (background):
        Browser fetches chunks 2, 3, 4... in parallel
        Each goes through decrypt → append cycle
        User can start watching while chunks load
        ↓
T+30s:  All 10 chunks loaded and decrypted
        Full video available in MediaSource
        User can seek anywhere, all data loaded
```

---

## Security Isolation

```
┌─────────────────────────────────┐
│  Plaintext Video Data           │
│  (Only exists in these places)  │
├─────────────────────────────────┤
│ 1. User's disk (before upload)  │
│ 2. Server RAM during:           │
│    - File upload (buffered)     │
│    - FFmpeg processing          │
│ 3. Browser RAM during:          │
│    - Decryption                 │
│    - MediaSource buffering      │
│    - Video playback             │
│ 4. Browser Video Renderer       │
│    (GPU memory, rendered frames)│
└─────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Encrypted Video Data                    │
│  (Transmitted over HTTPS/TLS)           │
├──────────────────────────────────────────┤
│ 1. Server → Telegram API                │
│    - 10 separate HTTPS POST requests    │
│    - Each chunk encrypted              │
│    - IV + AuthTag stored in DB         │
│                                          │
│ 2. Server ← Telegram API                │
│    - 10 separate HTTPS GET requests    │
│    - Each chunk encrypted              │
│                                          │
│ 3. Server → Browser                     │
│    - /api/stream responses             │
│    - Binary encrypted data in body     │
│    - IV + AuthTag in response headers  │
│                                          │
│ 4. Browser ↔ Network                    │
│    - All HTTP requests on HTTPS        │
│    - Encrypted by TLS layer            │
│    - Double encrypted: payload + TLS   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Master Password Security               │
├──────────────────────────────────────────┤
│ • Never sent to server after first use  │
│ • Only sent once during /api/upload     │
│ • Hashed with bcrypt for verification  │
│ • NEVER stored in localStorage          │
│ • Kept in React state (memory only)    │
│ • Cleared when component unmounts      │
│ • Browser-side key derivation uses it   │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  Bot Token Security                     │
├──────────────────────────────────────────┤
│ • Only stored on server                 │
│ • Never sent to browser                 │
│ • Used only for Telegram API calls     │
│ • Can't be extracted from network      │
│ • User can't see bot token             │
└──────────────────────────────────────────┘
```

---

## Key Derivation: Same Key Challenge

**Critical requirement for streaming:** The decryption key derived during streaming MUST match the key used during upload encryption.

Both must use the same parameters:

```javascript
// During UPLOAD (server-side):
const key = deriveEncryptionKey(masterPassword);
// Uses: PBKDF2(password, "telegram-file-manager-fixed-salt", 100k iterations, SHA-256)

// During STREAMING (browser-side):
const key = deriveKeyFromPassword(masterPassword);
// Must use: PBKDF2(password, salt, 100000, SHA-256)
// Same salt, same iterations!
```

**Why this works:**
1. User enters password during upload (verified once)
2. Same password entered during streaming
3. Deterministic derivation → identical key
4. Decryption succeeds

**If passwords don't match:**
- Browser tries to decrypt
- crypto.subtle.decrypt() fails (wrong key)
- Browser gets binary garbage
- VideoPlayer shows "Failed to decrypt" error

---

## Performance Optimization Opportunities

```
Current:                    Optimized:
┌─────────────────┐        ┌──────────────────────┐
│ Chunk 1 arrive  │        │ Chunk 1 arrive       │
│ Decrypt         │   →    │ Decrypt (parallel)   │
│ Append          │        │ Append (parallel)    │
│ Chunk 2 arrive  │        │                      │
│ Decrypt         │        │ Chunk 2 arrive       │
│ Append          │        │ Decrypt (parallel)   │
│ ...             │        │ Append (parallel)    │
└─────────────────┘        └──────────────────────┘

Improvements possible:
□ Web Worker for decryption (off main thread)
□ Parallel chunk downloads (HTTP/2 multiplexing)
□ Caching decrypted chunks in IndexedDB
□ Streaming partial manifests with HLS
```

---

## Troubleshooting Decision Tree

```
Video won't play?
├─ Check browser console for errors
│  ├─ "TypeError: mediaSource is not open" 
│  │  └─ Missing sourceopen event listener
│  └─ "NotSupportedError" 
│     └─ Browser doesn't support MediaSource with that codec
├─ Check if chunks are loading
│  ├─ DevTools Network tab → filter by /api/stream
│  ├─ Look for HTTP 200 responses
│  └─ Check response headers have x-iv and x-auth-tag
├─ Check decryption errors
│  ├─ Master password matches upload password?
│  ├─ IV correctly hex-decoded from headers?
│  └─ AuthTag correctly hex-decoded from headers?
└─ Check Telegram API connectivity
   ├─ Is Telegram API reachable?
   ├─ Bot token valid?
   └─ File IDs still valid (shouldn't expire)?
```
