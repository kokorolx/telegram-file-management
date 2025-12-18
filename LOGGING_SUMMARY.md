# Development Logging Summary

## What Was Added

Comprehensive logging throughout the entire file upload pipeline for **development visibility**.

### Modified Files (4)

1. **app/components/UploadForm.jsx**
   - Queue management logs
   - Password verification tracking
   - Upload progress monitoring
   - Completion and timing

2. **app/api/upload/route.js**
   - Request reception
   - File validation
   - Password authentication
   - Background processing tracking
   - Error handling with context

3. **lib/fileService.js**
   - FFmpeg optimization (detection, start, end, timing, size changes)
   - Encryption key derivation
   - Buffer chunking (total chunks calculated)
   - Chunk processing progress (1/8, 2/8, etc.)
   - Error handling with details

4. **lib/telegram.js**
   - File transmission tracking
   - API request details
   - Success confirmation with timing
   - Error reporting

### Log Format

```
[COMPONENT] [REQUEST-ID] - [STATUS] Message
```

**Components**: `[UPLOAD]`, `[API/UPLOAD]`, `[FILE-SERVICE]`, `[TELEGRAM]`

**Statuses**: 
- ✓ = Success
- ✗ = Error/Failure
- ⚠ = Warning/Fallback
- (blank) = Status update

### Example Logs

```javascript
// Browser Console (Client)
[UPLOAD] abc123def - Added to queue: video.mp4 (15.50MB) - ID: abc123def
[UPLOAD] abc123def - Password verification started for file: video.mp4
[UPLOAD] abc123def - ✓ Password verified successfully
[UPLOAD] abc123def - Starting file upload: video.mp4
[UPLOAD] abc123def - Sending to server...
[UPLOAD] abc123def - Progress: 65%
[UPLOAD] abc123def - ✓ Upload successful, server processing...
[UPLOAD] abc123def - ✓ COMPLETED in 52.3s

// Server Console (Terminal)
[API/UPLOAD] xyz789 - New upload request received
[API/UPLOAD] xyz789 - File: video.mp4, Size: 15.50MB
[API/UPLOAD] xyz789 - ✓ File validation passed
[API/UPLOAD] xyz789 - Starting background processing...
[API/UPLOAD] xyz789 - File ID: abc123def

[FILE-SERVICE] abc123def - Starting encrypted upload process
[FILE-SERVICE] abc123def - Detected video file, optimizing with FFmpeg...
[FILE-SERVICE] abc123def - ✓ FFmpeg optimization complete (28.4s)
[FILE-SERVICE] abc123def - Starting buffer encryption (total chunks: 8)
[FILE-SERVICE] abc123def - Processing chunk 1/8 (2.00MB)...
[FILE-SERVICE] abc123def - ✓ Encrypted chunk 1 (0.015s)
[FILE-SERVICE] abc123def - Uploading chunk 1 to Telegram...
[TELEGRAM] Sending file to Telegram: abc123def_part_1.enc (2.00MB)
[TELEGRAM] ✓ File uploaded successfully (3.2s) - File ID: AgACAgIA...
[FILE-SERVICE] abc123def - ✓ Buffer encryption complete (25.6s, 8 chunks)
[API/UPLOAD] xyz789 - ✓ Processing complete in 55.8s
```

## How to Use

### Monitor Browser Logs

1. Open DevTools: `F12` or `Cmd+Opt+I`
2. Go to **Console** tab
3. Upload a file
4. Filter by: `[UPLOAD]`
5. Watch in real-time

### Monitor Server Logs

1. Watch terminal running `npm run dev`
2. Upload triggers logs
3. Filter by: `[FILE-SERVICE]`, `[TELEGRAM]`, `[API/UPLOAD]`
4. All logs show in terminal automatically

### Trace a Single Upload

Every upload gets a unique ID. Use it to trace across browser and server:

```
Browser:  [UPLOAD] abc123def - ...
Server:   [FILE-SERVICE] abc123def - ...
Telegram: [TELEGRAM] ... (same operation)
```

**To find all logs for one upload:**
- Browser: Filter by `abc123def`
- Server: `grep abc123def logs.txt`

## Key Metrics Tracked

- ✓ File size (in MB)
- ✓ Operation duration (in seconds)
- ✓ Progress percentage
- ✓ Chunk numbers (1/8, 2/8, etc.)
- ✓ Success/failure status
- ✓ Error messages
- ✓ Timing for each phase:
  - FFmpeg optimization
  - Encryption
  - Telegram upload
  - Total duration

## Performance Baseline

For 500MB video:

| Operation | Expected Time |
|-----------|---------------|
| Password verify | <1s |
| FFmpeg optimize | 30-45s |
| Encryption | 5-10s |
| Telegram uploads (25 chunks) | 2-5s per chunk |
| **Total** | **50-70s** |

If actual times are 2x slower, investigate:
- CPU usage (FFmpeg slow)
- Network/API status (Telegram slow)
- Browser decryption (hardware acceleration)

## Common Debugging Scenarios

### "Upload is hanging"
1. Find upload ID: `[UPLOAD] xxx`
2. Search server logs for `xxx`
3. Look for where it stopped
4. Check last component involved

### "FFmpeg not found"
```
[FILE-SERVICE] id - ⚠ FFmpeg optimization failed
[FILE-SERVICE] id - ✓ Encrypted chunk (using original)
```
→ Install FFmpeg

### "Invalid password"
```
[API/UPLOAD] id - ✗ Invalid master password
[UPLOAD] id - ✗ FAILED: Invalid master password
```
→ Verify password matches

### "Network timeout"
```
[TELEGRAM] ✗ API error: Connection timeout
[FILE-SERVICE] ✗ Buffer encryption failed
```
→ Check internet / Telegram API status

## Security

Logs are **safe** because:
- ✓ No passwords logged
- ✓ No raw file content logged  
- ✓ Only metadata (filename, size)
- ✓ Telegram IDs truncated
- ✓ No sensitive data

## Troubleshooting Guide

| Issue | Log Pattern | Fix |
|-------|-------------|-----|
| Wrong password | `✗ Invalid master password` | Verify password |
| FFmpeg missing | `⚠ FFmpeg optimization failed` | Install FFmpeg |
| Network error | `✗ Connection timeout` | Check internet |
| Very slow | Check timings (2x baseline) | Profile system |
| Out of memory | Node memory error | Upload smaller file |

## File Reference

**Full documentation**: `LOGGING_GUIDE.md`
- Detailed log flow examples
- How to filter and search logs
- Real-world scenario walkthrough
- Advanced debugging tips

## Quick Commands

```bash
# Run development server
npm run dev

# Search server logs for specific upload (when saved)
grep "abc123def" server.log

# Filter logs by component in terminal
npm run dev | grep "\[FILE-SERVICE\]"
npm run dev | grep "\[TELEGRAM\]"
```

## Testing Checklist

When testing uploads:

- [ ] Check browser console for `[UPLOAD]` logs
- [ ] Check terminal for `[FILE-SERVICE]` logs
- [ ] Verify upload ID matches between browser and server
- [ ] Note FFmpeg optimization time
- [ ] Check total upload time
- [ ] Compare with baseline performance
- [ ] Look for any `✗` errors
- [ ] Verify file appears in database

## Next Steps

1. **Test with 20-50MB video** to see complete log flow
2. **Watch both console and terminal** simultaneously
3. **Note the upload ID** for later reference
4. **Check timing** against baseline
5. **Diagnose any issues** using log patterns

---

**Status**: Logging enabled for all development
**Output**: Browser console + Server terminal
**No Performance Impact**: Logs are fast, development-only

