# Caching Strategy Guide

Your file manager implements multi-level caching to optimize performance and reduce bandwidth usage.

---

## How Caching Works

### 1. Browser Caching (HTTP Cache)

Files are cached locally in your browser based on file type:

| File Type | Cache Duration | Use Case |
|-----------|----------------|----------|
| **Images** (jpg, png, gif, webp) | 30 days | Rarely change, heavy downloads |
| **Videos** (mp4, webm, mkv) | 7 days | Occasionally updated, large files |
| **Audio** (mp3, m4a, wav) | 7 days | Rarely updated, streaming support |
| **Documents** (pdf, docx, txt) | 1 day | May be updated frequently |
| **Other files** | 1 day | Default, conservative approach |

### 2. Cache Validation (ETag)

Each file has an **ETag** (unique identifier):
- Browser checks if file changed before downloading
- If unchanged, serves from local cache instantly
- If changed, downloads new version
- **No bandwidth wasted** on unchanged files

### 3. How to Clear Cache

**Entire Browser Cache:**
```
DevTools → Application → Storage → Clear site data
```

**Single File Cache:**
```
Hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
```

**Automatic Cache Expiration:**
```
- Images: Automatically cleared after 30 days
- Videos: Automatically cleared after 7 days
- Documents: Automatically cleared after 1 day
```

---

## For Users: Cache Tips

### When Files Are Cached

1. **First Download**
   - File is downloaded and cached
   - Takes normal time

2. **Second Download (same file)**
   - Browser checks if file changed
   - If unchanged, loads from cache instantly
   - **Same download takes <100ms**

3. **Browsing Repeatedly**
   - Images load from cache instantly
   - No re-downloading from Telegram
   - Zero bandwidth for cached files

### Example: Photo Album Workflow

```
1. Upload 50 vacation photos
2. Browse & view all photos (15MB total)
3. Close browser
4. Next day: Open app and view same photos
5. Result: Instant loading, ZERO bandwidth used
```

### When Cache Gets Refreshed

- **30 days pass** (images)
- **7 days pass** (videos)
- **1 day passes** (documents)
- **You manually refresh** (Cmd/Ctrl+Shift+R)
- **File is updated** (re-uploaded)

---

## For Developers: Cache Implementation

### Cache Headers Sent to Browser

```javascript
// Images (30 days)
Cache-Control: public, max-age=2592000

// Videos/Audio (7 days)
Cache-Control: public, max-age=604800

// Documents (1 day)
Cache-Control: public, max-age=86400

// ETag for validation
ETag: "base64encodedHash"

// Cache busting
Vary: Accept-Encoding
```

### How to Modify Cache Duration

Edit `app/api/download/route.js`:

```javascript
// Current (change these values):
const cacheControl = 'public, max-age=2592000'; // 30 days for images

// Examples:
'public, max-age=1209600'    // 14 days
'public, max-age=604800'     // 7 days
'public, max-age=86400'      // 1 day
'public, max-age=3600'       // 1 hour
'no-cache'                   // Always revalidate
'no-store'                   // Never cache
```

### Time Conversion

```
60 = 1 minute
3600 = 1 hour
86400 = 1 day
604800 = 1 week
2592000 = 30 days
31536000 = 1 year
```

### Disable Caching (for testing)

Edit `app/api/download/route.js`:

```javascript
// Replace cache control logic with:
const cacheControl = 'no-store, no-cache, must-revalidate, proxy-revalidate';
```

Then restart the app. Every download will fetch fresh from Telegram.

---

## Browser Cache Storage

### How Much Space is Used?

Browser cache is **limited by your browser settings**:

- **Chrome/Edge**: ~10GB shared quota
- **Firefox**: ~10GB per origin
- **Safari**: ~50MB-500MB
- **iOS Safari**: ~50MB

### Monitor Cache Size

**Chrome/Edge DevTools:**
```
DevTools → Application → Cache Storage → See size
```

**Firefox Developer Tools:**
```
Storage → Cache Storage → Check size
```

### Clear Cache When Low on Space

```
DevTools → Application → Clear storage → Clear site data
```

---

## Caching Strategy by Scenario

### Scenario 1: Personal Photo Library (Recommended)
```
- 500 photos (2GB total)
- View daily
- Rarely update

Cache Duration: 30 days
Result: Photos load instantly after first view
Storage: Minimal impact (browser limits total)
```

### Scenario 2: Video Library
```
- 50 videos (50GB total)
- Watch once or twice
- Rarely updated

Cache Duration: 7 days
Result: Rewatching videos is instant
Storage: Won't cache all due to browser limits
```

### Scenario 3: Work Documents
```
- 100 PDFs (1GB)
- Accessed multiple times
- May be updated

Cache Duration: 1 day
Result: Smart revalidation (ETag checks before updating)
Storage: Efficient
```

### Scenario 4: Large Archive
```
- 10,000 files (500GB)
- Infrequent access
- Rarely updated

Solution: Use search to find files
Cache helps with repeated access
Browser naturally limits storage
```

---

## Network & Bandwidth Optimization

### Before Caching
```
Open File A → 50MB download
Close browser
Next day, open File A → 50MB download again
Total: 100MB bandwidth
```

### With Caching
```
Open File A → 50MB download (cached)
Close browser
Next day, open File A → 0MB download (cache check only)
Total: 50MB bandwidth + minimal validation
Saving: 50MB+
```

### Large Project Savings

**Without Caching:**
```
30 days × 5 projects per day × 100MB = 15GB bandwidth
```

**With Caching:**
```
Initial download: 15GB
Revalidation: ~5MB (ETag checks)
Saving: 15GB - 5MB = 14.995GB bandwidth
```

---

## Video Streaming with Cache

### HTTP Partial Content Requests

For video files, browsers use **Range requests**:

```
Request: GET /api/download?file_id=abc123
Header: Range: bytes=0-1048576
Result: Only first 1MB downloaded
```

Benefits:
- Start watching before entire video downloads
- Seek to middle of video without downloading all
- Browser caches segments separately
- Bandwidth efficient

### Example: 1GB Video File

```
Scenario 1: No caching
- Watch 5 minutes (25% of video)
- 250MB downloaded

Scenario 2: With caching + Range requests
- Watch 5 minutes (25% of video)
- 250MB downloaded + cached
- Watch next week from same position
- 0MB downloaded (cache hits)
```

---

## Service Worker Caching (Optional Advanced)

For offline support, you can add a service worker:

```javascript
// public/service-worker.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('file-manager-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/styles.css',
        '/app.js'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
      .catch(() => caches.match('/offline.html'))
  );
});
```

**Benefits:**
- App works offline
- Instant loads from cache
- Falls back gracefully

**Current Status:** Not implemented (optional)

---

## Troubleshooting Cache Issues

### Problem: File Updated But Still See Old Version

**Solution 1: Hard Refresh**
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

**Solution 2: Clear Cache**
```
DevTools → Application → Clear storage → Clear site data
```

**Solution 3: Check ETag**
```
DevTools → Network → Click file → Headers
Look for: ETag header
If ETag changed, file is updated
```

### Problem: Cache Taking Too Much Space

**Solution 1: Clear Cache**
```
DevTools → Application → Clear storage
```

**Solution 2: Check Browser Limits**
```
System Settings → Storage → Browser cache
May be limited to 10GB total
```

**Solution 3: Adjust Cache Duration**
```
Edit app/api/download/route.js
Reduce max-age values
```

### Problem: Slow First Load

**This is normal:**
```
- First load: Downloads from Telegram (slow)
- Second load: From browser cache (instant)
- Subsequent loads: Cache hit (instant)
```

**To speed up initial load:**
- Search for specific files (faster than browse all)
- Use pagination to load fewer files

---

## Monitoring Cache Performance

### Chrome DevTools Network Tab

1. Open DevTools (F12)
2. Click **Network** tab
3. Download a file
4. Look for:

```
Size: "1.2 MB from disk cache" ← Cached file
Size: "1.2 MB" ← Fresh download
```

### Check Cache Hit Rate

```javascript
// Paste in DevTools console:
fetch('http://localhost:3000/api/download?file_id=your-file-id')
  .then(r => {
    console.log('Cache status:', r.headers.get('X-Cache'));
    console.log('Content-Type:', r.headers.get('Content-Type'));
    console.log('Cache-Control:', r.headers.get('Cache-Control'));
  });
```

---

## Future Enhancements

- [ ] IndexedDB for larger cache (up to 500MB per origin)
- [ ] Service Worker for offline support
- [ ] Cache preloading for frequently accessed files
- [ ] Intelligent cache clearing (oldest first)
- [ ] Cache statistics dashboard
- [ ] Per-file cache control in UI

---

## Summary

| Feature | Status | Benefits |
|---------|--------|----------|
| Browser Caching | ✅ Enabled | Instant loads on repeated access |
| ETag Validation | ✅ Enabled | Smart revalidation, no wasted bandwidth |
| Duration by Type | ✅ Enabled | Images longer, documents shorter |
| HTTP Range Requests | ✅ Auto | Stream videos without full download |
| Service Worker | ❌ Optional | For offline support (can add) |
| IndexedDB Cache | ❌ Optional | For larger cache capacity (can add) |

**Current:** 3 of 6 features enabled, providing significant performance boost.

---

**Last Updated:** December 2025
