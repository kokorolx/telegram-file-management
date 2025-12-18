# Development Logging Guide

## Overview

Comprehensive logging has been added to track file uploads from start to finish. Each upload gets a unique request ID for tracing through the entire flow.

---

## Log Format

All logs use a consistent format:

```
[COMPONENT] [REQUEST-ID] - [STATUS] Message
```

### Components
- `[UPLOAD]` - Browser-side upload component
- `[API/UPLOAD]` - Server upload endpoint
- `[FILE-SERVICE]` - File optimization and encryption
- `[TELEGRAM]` - Telegram API interactions

### Statuses
- ✓ = Success step
- ✗ = Error/failure
- (blank) = Status update
- ⚠ = Warning/fallback

---

## Log Flow for a Typical Upload

### Step 1: User Selects File
```
[UPLOAD] Added to queue: video.mp4 (15.50MB) - ID: abc123def
```

### Step 2: Password Verification
```
[UPLOAD] abc123def - Password verification started for file: video.mp4
[UPLOAD] abc123def - ✓ Password verified successfully
[UPLOAD] abc123def - Starting file upload: video.mp4
```

### Step 3: Browser Sends to Server
```
[UPLOAD] abc123def - Starting upload: video.mp4
[UPLOAD] abc123def - Sending to server...
[UPLOAD] abc123def - Progress: 65%
[UPLOAD] abc123def - Progress: 71%
```

### Step 4: Server Receives
```
[API/UPLOAD] xyz789 - New upload request received
[API/UPLOAD] xyz789 - File: video.mp4, Size: 15.50MB
[API/UPLOAD] xyz789 - Folder: root, Custom name: none
[API/UPLOAD] xyz789 - ✓ File validation passed
[API/UPLOAD] xyz789 - Validating master password...
[API/UPLOAD] xyz789 - ✓ Password valid
[API/UPLOAD] xyz789 - Converting file to buffer...
[API/UPLOAD] xyz789 - Starting background processing (FFmpeg optimize + encrypt + chunk)...
[API/UPLOAD] xyz789 - File ID: abc123def
```

### Step 5: Browser Receives Response
```
[UPLOAD] abc123def - ✓ Upload successful, server processing...
[UPLOAD] abc123def - Response: {success: true, data: {id: "abc123def", ...}}
[UPLOAD] abc123def - ✓ COMPLETED in 45.2s
```

### Step 6: Server Processing (Background)
```
[FILE-SERVICE] abc123def - Starting encrypted upload process
[FILE-SERVICE] abc123def - File: video.mp4, Size: 15.50MB
[FILE-SERVICE] abc123def - Detected video file, optimizing with FFmpeg...
[FILE-SERVICE] abc123def - ✓ FFmpeg optimization complete (28.4s, saved 102KB)
[FILE-SERVICE] abc123def - Original: 15.50MB → Optimized: 15.49MB
[FILE-SERVICE] abc123def - Deriving encryption key from password...
[FILE-SERVICE] abc123def - ✓ Key derived, starting encryption and chunking...
[FILE-SERVICE] abc123def - Starting buffer encryption (total chunks: 8)
[FILE-SERVICE] abc123def - Processing chunk 1/8 (2.00MB)...
[FILE-SERVICE] abc123def - Encrypting chunk 1...
[FILE-SERVICE] abc123def - ✓ Encrypted chunk 1 (0.015s)
[FILE-SERVICE] abc123def - IV: a1b2c3d4e5f6g7h8..., AuthTag: m2n3o4p5q6r7s8t9...
[FILE-SERVICE] abc123def - Uploading chunk 1 to Telegram as abc123def_part_1.enc...
[TELEGRAM] Sending file to Telegram: abc123def_part_1.enc (2.00MB)
[TELEGRAM] Making API request (timeout: 30s, retries: 3)...
[TELEGRAM] ✓ File uploaded successfully (3.2s) - File ID: AgACAgIAAxk...
[FILE-SERVICE] abc123def - ✓ Uploaded to Telegram (3.2s), Telegram ID: AgACAgIAAxk...
[FILE-SERVICE] abc123def - Saving chunk metadata to database...
[FILE-SERVICE] abc123def - ✓ Chunk 1 complete
[FILE-SERVICE] abc123def - Processing chunk 2/8 (2.00MB)...
... (repeat for chunks 2-8)
[FILE-SERVICE] abc123def - ✓ Buffer encryption complete (25.6s, 8 chunks)
[API/UPLOAD] xyz789 - ✓ Processing complete in 55.8s
```

---

## How to Monitor Logs

### Browser Console (Client-Side)
1. Open DevTools: `F12` or `Cmd+Opt+I` (macOS)
2. Go to Console tab
3. Filter by `[UPLOAD]` to see browser-side logs
4. Look for upload ID (e.g., `abc123def`) to trace requests

**Example filter in DevTools:**
```javascript
// Click filter icon, type:
[UPLOAD]
```

### Server Console (Terminal)
1. Look at terminal running `npm run dev`
2. Filter by request ID or component name
3. Watch for errors (marked with ✗)

**Example terminal output:**
```
[API/UPLOAD] xyz789 - New upload request received
[FILE-SERVICE] abc123def - Starting encrypted upload process
[TELEGRAM] Sending file to Telegram: abc123def_part_1.enc (2.00MB)
```

---

## Debugging with Logs

### Trace a Single Upload

All logs related to one upload use the same ID:
- Browser: `[UPLOAD] abc123def`
- Server: `[FILE-SERVICE] abc123def`
- Telegram: `[TELEGRAM]` (no ID, but logs file being sent)

**To follow one upload:**
1. Note the ID from browser: `abc123def`
2. Search server logs for: `abc123def`
3. You'll see entire lifecycle

### Find Errors

Search for these patterns:
- `✗` = Error occurred
- `❌` = Failed step
- `⚠` = Warning (fallback used)

**Example error sequence:**
```
[API/UPLOAD] xyz789 - Validating master password...
[API/UPLOAD] xyz789 - ✗ Invalid master password
[API/UPLOAD] xyz789 - ✗ UPLOAD FAILED: Invalid master password
[UPLOAD] abc123def - ✗ FAILED: Invalid master password
```

### Check Performance

Look for timing in logs:

```
[FILE-SERVICE] abc123def - ✓ FFmpeg optimization complete (28.4s, saved 102KB)
[TELEGRAM] ✓ File uploaded successfully (3.2s) - File ID: ...
[FILE-SERVICE] abc123def - ✓ Buffer encryption complete (25.6s, 8 chunks)
```

**Performance breakdown for 500MB video:**
- FFmpeg optimization: ~30-45s
- Encryption + Telegram upload: ~20-30s
- Total: ~50-70s

---

## Log Levels and Meaning

### Level 1: Info (No prefix)
Normal operations, status updates

```
[FILE-SERVICE] abc123def - Processing chunk 1/8 (2.00MB)...
```

### Level 2: Success (✓)
Operation completed successfully

```
[FILE-SERVICE] abc123def - ✓ Password verified successfully
```

### Level 3: Warning (⚠)
Non-fatal issue, fallback used

```
[FILE-SERVICE] abc123def - ⚠ FFmpeg optimization failed, using original
```

### Level 4: Error (✗ or ❌)
Operation failed, needs attention

```
[API/UPLOAD] xyz789 - ✗ Validation failed: File too large
```

---

## Common Log Patterns

### Successful Upload
```
[UPLOAD] ID - Starting upload: filename
[UPLOAD] ID - Sending to server...
[API/UPLOAD] ID2 - New upload request received
[API/UPLOAD] ID2 - ✓ File validation passed
[API/UPLOAD] ID2 - ✓ Password valid
[API/UPLOAD] ID2 - Starting background processing...
[FILE-SERVICE] ID - ✓ FFmpeg optimization complete
[FILE-SERVICE] ID - ✓ Buffer encryption complete
[API/UPLOAD] ID2 - ✓ Processing complete in Xs
[UPLOAD] ID - ✓ COMPLETED in Xs
```

### FFmpeg Not Found
```
[FILE-SERVICE] ID - Detected video file, optimizing with FFmpeg...
[FILE-SERVICE] ID - ⚠ FFmpeg optimization failed: spawn ENOENT
[FILE-SERVICE] ID - ✓ Encrypted chunk 1 (using original file)
```

### Invalid Password
```
[UPLOAD] ID - Password verification started
[API/UPLOAD] ID2 - Validating master password...
[API/UPLOAD] ID2 - ✗ Invalid master password
[UPLOAD] ID - ✗ FAILED: Invalid master password
```

### Network Error (Telegram)
```
[TELEGRAM] Sending file to Telegram: filename
[TELEGRAM] Making API request (timeout: 30s, retries: 3)...
[TELEGRAM] ✗ API error: Connection timeout
[TELEGRAM] ✗ Upload failed: Connection timeout
[FILE-SERVICE] ID - ✗ Buffer encryption failed: Upload to Telegram failed
```

---

## Filtering Logs

### By Component
```
// Browser console
filter: [UPLOAD]

// Server terminal (use grep)
| grep "\[API/UPLOAD\]"
| grep "\[FILE-SERVICE\]"
| grep "\[TELEGRAM\]"
```

### By Request ID
```
// Find all logs for one upload
grep "abc123def" server_logs.txt

// In browser DevTools
filter: abc123def
```

### By Status
```
// Find all errors
grep "✗" server_logs.txt
grep "❌" server_logs.txt

// Find all successes
grep "✓" server_logs.txt
```

### By Time
```
// Logs include timing info
[FILE-SERVICE] ID - ✓ complete (28.4s)

// Sort by duration to find slow operations
```

---

## Performance Baseline

These are expected times for a 500MB video:

| Operation | Time | Component |
|-----------|------|-----------|
| Password verification | <1s | [API/UPLOAD] |
| FFmpeg optimization | 30-45s | [FILE-SERVICE] |
| Encryption | 5-10s | [FILE-SERVICE] |
| Chunk 1 to Telegram | 2-5s | [TELEGRAM] |
| Other chunks (parallel) | 2-5s each | [TELEGRAM] |
| Total server time | 50-70s | All |
| Browser upload | 50-70s | [UPLOAD] |

If times exceed these by 2x, something might be wrong:
- FFmpeg slow? Check CPU
- Telegram slow? Check network/API status
- Encryption slow? Check decryption in browser (Hardware acceleration)

---

## Disabling Logs (Production)

To disable logs in production, set environment variable:
```env
NODE_ENV=production
LOG_LEVEL=error  # or 'warn'
```

Or wrap logs in conditional:
```javascript
if (process.env.NODE_ENV !== 'production') {
  console.log('[UPLOAD]', ...);
}
```

For now (development), all logs are enabled.

---

## Adding New Logs

If you add features, follow the pattern:

```javascript
// Start of operation
console.log(`[COMPONENT] ${id} - Starting operation...`);

// During operation
console.log(`[COMPONENT] ${id} - Progress: X/Y`);

// Success
console.log(`[COMPONENT] ${id} - ✓ Operation complete (${duration}s)`);

// Error
console.error(`[COMPONENT] ${id} - ✗ Operation failed: ${error.message}`);
```

Use consistent formatting:
- Always include component in brackets
- Always include ID when available
- Always include status indicator (✓, ✗, ⚠)
- Always include timing for long operations
- Always include relevant data (file size, chunk number, etc.)

---

## Real-World Example

### Scenario: Upload 50MB video

**Browser Console:**
```
[UPLOAD] ab12cd34 - Added to queue: MyVideo.mp4 (50.00MB) - ID: ab12cd34
[UPLOAD] ab12cd34 - Password verification started for file: MyVideo.mp4
[UPLOAD] ab12cd34 - ✓ Password verified successfully
[UPLOAD] ab12cd34 - Starting file upload: MyVideo.mp4
[UPLOAD] ab12cd34 - Sending to server...
[UPLOAD] ab12cd34 - Progress: 52%
[UPLOAD] ab12cd34 - Progress: 68%
[UPLOAD] ab12cd34 - ✓ Upload successful, server processing...
[UPLOAD] ab12cd34 - Response: {success: true, data: {id: "ab12cd34", name: "MyVideo.mp4", is_encrypted: true, status: "encrypting"}}
[UPLOAD] ab12cd34 - ✓ COMPLETED in 52.3s
```

**Server Console:**
```
[API/UPLOAD] xyz789abc - New upload request received
[API/UPLOAD] xyz789abc - File: MyVideo.mp4, Size: 50.00MB
[API/UPLOAD] xyz789abc - Folder: root, Custom name: none
[API/UPLOAD] xyz789abc - ✓ File validation passed
[API/UPLOAD] xyz789abc - Validating master password...
[API/UPLOAD] xyz789abc - ✓ Password valid
[API/UPLOAD] xyz789abc - Converting file to buffer...
[API/UPLOAD] xyz789abc - Starting background processing (FFmpeg optimize + encrypt + chunk)...
[API/UPLOAD] xyz789abc - File ID: ab12cd34

[FILE-SERVICE] ab12cd34 - Starting encrypted upload process
[FILE-SERVICE] ab12cd34 - File: MyVideo.mp4, Size: 50.00MB
[FILE-SERVICE] ab12cd34 - Detected video file, optimizing with FFmpeg...
[FILE-SERVICE] ab12cd34 - ✓ FFmpeg optimization complete (15.2s, saved 45KB)
[FILE-SERVICE] ab12cd34 - Original: 50.00MB → Optimized: 50.00MB
[FILE-SERVICE] ab12cd34 - Deriving encryption key from password...
[FILE-SERVICE] ab12cd34 - ✓ Key derived, starting encryption and chunking...
[FILE-SERVICE] ab12cd34 - Starting buffer encryption (total chunks: 25)

[FILE-SERVICE] ab12cd34 - Processing chunk 1/25 (2.00MB)...
[FILE-SERVICE] ab12cd34 - Encrypting chunk 1...
[FILE-SERVICE] ab12cd34 - ✓ Encrypted chunk 1 (0.014s)
[FILE-SERVICE] ab12cd34 - IV: a1b2c3d4e5f6g7h8..., AuthTag: m2n3o4p5q6r7s8t9...
[FILE-SERVICE] ab12cd34 - Uploading chunk 1 to Telegram as ab12cd34_part_1.enc...
[TELEGRAM] Sending file to Telegram: ab12cd34_part_1.enc (2.00MB)
[TELEGRAM] Making API request (timeout: 30s, retries: 3)...
[TELEGRAM] ✓ File uploaded successfully (2.1s) - File ID: AgACAgIAAxk...

[FILE-SERVICE] ab12cd34 - ✓ Uploaded to Telegram (2.1s), Telegram ID: AgACAgIAAxk...
[FILE-SERVICE] ab12cd34 - Saving chunk metadata to database...
[FILE-SERVICE] ab12cd34 - ✓ Chunk 1 complete

[FILE-SERVICE] ab12cd34 - Processing chunk 2/25 (2.00MB)...
...
[FILE-SERVICE] ab12cd34 - Processing chunk 25/25 (0.15MB)...
[FILE-SERVICE] ab12cd34 - ✓ Chunk 25 complete

[FILE-SERVICE] ab12cd34 - ✓ Buffer encryption complete (37.4s, 25 chunks)
[API/UPLOAD] xyz789abc - ✓ Processing complete in 52.8s
```

**What this tells us:**
- ✅ Upload successful
- ✅ FFmpeg optimization worked (15.2s)
- ✅ All 25 chunks encrypted and uploaded
- ✅ Average chunk time: ~1.5s
- ✅ Total time: ~52s (reasonable for 50MB)

---

## Troubleshooting Table

| Problem | Log Pattern | Solution |
|---------|-------------|----------|
| Password wrong | `✗ Invalid master password` | Verify password matches setup |
| File too large | `✗ Validation failed: File too large` | Check file size limits |
| FFmpeg missing | `⚠ FFmpeg optimization failed` | Install FFmpeg |
| Network timeout | `✗ Connection timeout` | Check internet, Telegram API |
| Database error | `✗ Buffer encryption failed` | Check database connection |
| Out of memory | `Node: memory limit exceeded` | Upload smaller file |

---

## Next Steps

1. Test upload with 20MB video
2. Watch browser console for `[UPLOAD]` logs
3. Watch server console for `[FILE-SERVICE]` and `[TELEGRAM]` logs
4. Verify IDs match between browser and server
5. Check timings match performance baseline
6. If something seems off, search logs by ID for full trace

