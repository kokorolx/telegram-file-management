# PDF Streaming & Per-Page Viewing - Implementation Plan

## Executive Summary

The system can be enhanced to stream PDFs efficiently by pages/chunks instead of loading the entire file. This is useful for large PDFs (100MB+) where full downloads are slow.

**Current State:** PDFs are downloaded completely before display (iframe)  
**Target State:** Stream PDF by pages, display immediately, load subsequent pages on demand

---

## Architecture Analysis

### Current Infrastructure ✅

The system already has excellent streaming foundation:

1. **Chunked File Upload System**
   - Files split into 2MB chunks
   - Each chunk encrypted, stored in Telegram
   - Metadata tracked in `file_parts` table

2. **Streaming Endpoints**
   - `/api/stream/route.js` - Full streaming with range request support
   - `/api/stream/[fileId]/route.js` - Per-chunk streaming
   - Supports HTTP range requests for seeking

3. **Encryption Support**
   - AES-256-GCM encryption per chunk
   - IV and auth tag stored separately
   - Browser-side decryption capability

### Current PDF Display ❌

```javascript
// PreviewModal.jsx line 290-298
{file.mime_type?.includes('pdf') && (
    <div className="w-full h-[75vh]">
        <iframe
            src={secureSrc}  // Blob URL to entire decrypted PDF
            className="w-full h-full rounded shadow-sm border border-gray-200"
            title={file.original_filename}
        />
    </div>
)}
```

**Problem:** Downloads entire PDF before showing iframe

---

## Implementation Plan - Three Approaches

### Approach 1: PDF.js with Streaming (RECOMMENDED) ⭐

**Best for:** Large PDFs, granular page control, offline viewing

#### How It Works
```
User opens PDF preview
  ↓
Load PDF.js library
  ↓
Initialize PDF document (no download yet)
  ↓
Fetch Range: bytes 0-2MB
  ↓
Display first 10 pages immediately
  ↓
Prefetch next 10 pages in background
  ↓
User scrolls → Load more pages on demand
```

#### Implementation Steps

**1. Install PDF.js**
```bash
npm install pdfjs-dist
```

**2. Create New Component: `PdfViewer.jsx`**
```javascript
'use client';
import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export default function PdfViewer({ fileId, fileName, isEncrypted, masterPassword }) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Set up worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  }, []);

  // Load PDF on mount
  useEffect(() => {
    const loadPdf = async () => {
      try {
        setLoading(true);
        
        // For encrypted files: fetch with password
        let pdfUrl;
        if (isEncrypted) {
          const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              file_id: fileId, 
              master_password: masterPassword 
            })
          });
          const blob = await res.blob();
          pdfUrl = URL.createObjectURL(blob);
        } else {
          pdfUrl = `/api/download?file_id=${fileId}`;
        }

        // Load PDF
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        setNumPages(pdf.numPages);
      } catch (err) {
        console.error('PDF load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [fileId, isEncrypted, masterPassword]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {loading && <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />}
      
      <div className="flex items-center gap-2">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
          ← Previous
        </button>
        <span>Page {currentPage} of {numPages}</span>
        <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage === numPages}>
          Next →
        </button>
      </div>

      <PdfPage fileId={fileId} pageNum={currentPage} />
    </div>
  );
}

// Separate component for each page
function PdfPage({ fileId, pageNum }) {
  const [image, setImage] = useState(null);

  useEffect(() => {
    const renderPage = async () => {
      const res = await fetch(`/api/pdf/page?file_id=${fileId}&page=${pageNum}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setImage(url);
    };
    renderPage();
  }, [fileId, pageNum]);

  return <img src={image} alt={`Page ${pageNum}`} className="max-w-full max-h-[70vh]" />;
}
```

**3. Create PDF Page Extraction Endpoint: `/api/pdf/page`**
```javascript
// app/api/pdf/page/route.js
import { pdf } from 'pdf-parse';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('file_id');
  const pageNum = parseInt(searchParams.get('page'));

  // Fetch PDF (chunked if large)
  const pdfBuffer = await fetchPdfBuffered(fileId);
  
  // Extract page and convert to image
  const image = await extractPageAsImage(pdfBuffer, pageNum);
  
  return new Response(image, {
    headers: { 'Content-Type': 'image/png' }
  });
}
```

**4. Update PreviewModal to Use New Component**
```javascript
{file.mime_type?.includes('pdf') && (
    <PdfViewer 
      fileId={file.id} 
      fileName={file.original_filename}
      isEncrypted={file.is_encrypted}
      masterPassword={masterPassword}
    />
)}
```

#### Pros & Cons

✅ **Pros:**
- Per-page rendering (fast initial load)
- Granular control over memory usage
- Can display page thumbnails
- Better for large PDFs (100MB+)
- Works offline (after caching)
- Mobile-friendly zoom

❌ **Cons:**
- Requires `/api/pdf/page` endpoint
- Need `pdf-parse` library (+500KB)
- Page rendering takes CPU time
- No search within PDF (unless implemented)

---

### Approach 2: Streaming Blob URL (SIMPLER) 🚀

**Best for:** Medium PDFs (< 50MB), quick implementation

#### How It Works
```
User opens PDF
  ↓
Fetch first 2MB chunk (range request)
  ↓
Create blob URL from partial data
  ↓
Display in iframe (shows available pages)
  ↓
Continue fetching next chunks
  ↓
PDF viewer streams remaining data
```

#### Implementation

**Update PreviewModal.jsx:**

```javascript
{file.mime_type?.includes('pdf') && (
    <StreamingPdfViewer 
      fileId={file.id}
      fileName={file.original_filename}
      fileSize={file.file_size}
      isEncrypted={file.is_encrypted}
      masterPassword={masterPassword}
    />
)}
```

**Create StreamingPdfViewer.jsx:**

```javascript
'use client';
import { useEffect, useState } from 'react';

export default function StreamingPdfViewer({ 
  fileId, fileName, fileSize, isEncrypted, masterPassword 
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const streamPdf = async () => {
      try {
        if (isEncrypted) {
          // For encrypted: fetch full file (must decrypt)
          const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: fileId, master_password: masterPassword })
          });
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        } else {
          // For unencrypted: stream with range requests
          const chunks = [];
          const chunkSize = 1024 * 1024; // 1MB chunks
          
          for (let start = 0; start < fileSize; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, fileSize - 1);
            const range = `bytes=${start}-${end}`;
            
            const res = await fetch(`/api/download?file_id=${fileId}`, {
              headers: { Range: range }
            });
            
            chunks.push(await res.blob());
            setProgress(Math.round((end / fileSize) * 100));
          }
          
          const fullBlob = new Blob(chunks, { type: 'application/pdf' });
          const url = URL.createObjectURL(fullBlob);
          setBlobUrl(url);
        }
      } catch (err) {
        console.error('PDF streaming error:', err);
      } finally {
        setLoading(false);
      }
    };

    streamPdf();
  }, [fileId, fileSize, isEncrypted, masterPassword]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">{progress}% loaded</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[75vh]">
      <iframe
        src={blobUrl}
        className="w-full h-full rounded shadow-sm border border-gray-200"
        title={fileName}
      />
    </div>
  );
}
```

#### Pros & Cons

✅ **Pros:**
- Simple implementation (minimal code)
- Uses existing `/api/download` endpoint
- Responsive UI with progress bar
- Works with encrypted files
- No new dependencies

❌ **Cons:**
- Still downloads entire PDF (eventually)
- No per-page control
- Uses browser memory for full blob
- Not optimal for very large files (1GB+)

---

### Approach 3: HTTP Range Requests (BEST FOR STREAMING) 💎

**Best for:** Large PDFs (50MB+), true streaming, bandwidth optimization

#### How It Works
```
Browser requests: Range: bytes=0-1048575
  ↓
Server sends first 1MB
  ↓
Browser loads PDF header from first 1MB
  ↓
Browser sees it's a PDF with 500 pages
  ↓
Browser requests: Range: bytes=1048576-2097151 (next 1MB)
  ↓
User sees pages 1-50 immediately
  ↓
Pages 51-500 stream in background
  ↓
User scrolls to page 400
  ↓
Browser requests: Range: bytes=x-y (just that section)
  ↓
No redundant data transfer
```

#### Implementation

**1. Update `/api/download` to Support Range Requests**

```javascript
// app/api/download/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('file_id');
  
  const file = await getFileById(fileId);
  
  // Get range header if present
  const rangeHeader = request.headers.get('range');
  
  if (rangeHeader && !file.is_encrypted) {
    // Handle range request directly
    return handleRangeRequest(rangeHeader, file);
  }
  
  // Otherwise full file (existing logic)
  return handleFullDownload(file);
}

function handleRangeRequest(rangeHeader, file) {
  const range = parseRange(rangeHeader);
  const start = range.start || 0;
  const end = range.end || file.file_size - 1;
  
  // Stream this range from Telegram
  const stream = streamFileRange(file.id, start, end);
  
  return new NextResponse(stream, {
    status: 206, // Partial Content
    headers: {
      'Content-Range': `bytes ${start}-${end}/${file.file_size}`,
      'Content-Length': (end - start + 1).toString(),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/pdf'
    }
  });
}
```

**2. Browser Automatically Handles Ranges**

Modern browsers (Chrome, Firefox, Safari) automatically:
- Send Range headers when loading PDFs
- Request only needed byte ranges
- Cache ranges to avoid re-fetching
- Show progress as ranges arrive

**3. Just Update PreviewModal**

```javascript
{file.mime_type?.includes('pdf') && !file.is_encrypted && (
    <div className="w-full h-[75vh]">
        <iframe
            src={`/api/download?file_id=${file.id}`}
            className="w-full h-full rounded shadow-sm border border-gray-200"
            title={file.original_filename}
        />
    </div>
)}
```

#### Pros & Cons

✅ **Pros:**
- True streaming (no waiting for full file)
- Minimal code change required
- Browser handles all complexity
- Works with very large files
- Automatic caching by browser
- Bandwidth efficient

❌ **Cons:**
- Only works for unencrypted PDFs (ranges break encryption)
- Requires Range request support in `/api/download`
- Some cloud storage may not support ranges

---

## Recommended Implementation Path

### Phase 1: Quick Fix (Week 1) ✅
**Implement Approach 2: Streaming Blob URL**
- Simple progress bar
- Works with encrypted files
- Minimal code changes
- Good UX improvement

### Phase 2: Enhancement (Week 2-3) ⭐
**Add Approach 3: HTTP Range Requests**
- For unencrypted PDFs
- Optimal streaming
- No changes to encrypted flow

### Phase 3: Advanced (Week 4+) 💎
**Implement Approach 1: PDF.js**
- Per-page rendering
- Page thumbnails
- Text search in PDF
- Offline support

---

## Comparison Table

| Feature | Approach 1 (PDF.js) | Approach 2 (Blob) | Approach 3 (Ranges) |
|---------|-------------------|-------------------|-------------------|
| **Setup Time** | High | Low | Medium |
| **Code Complexity** | High | Low | Low |
| **Dependencies** | pdfjs-dist + pdf-parse | None | None |
| **Memory Usage** | Low | Medium | Very Low |
| **Encrypted Support** | Yes | Yes | No |
| **Page Control** | Excellent | None | None |
| **Bandwidth Efficiency** | Medium | Medium | Excellent |
| **Initial Load Speed** | Very Fast | Slow | Very Fast |
| **PDF Size (100MB)** | ✅ Great | ❌ Slow | ✅✅ Best |
| **Mobile Support** | ✅ Good | ⚠️ Medium | ✅ Good |

---

## Implementation Details - Phase 1

### Step 1: Create StreamingPdfViewer Component

```javascript
// app/components/StreamingPdfViewer.jsx
'use client';
import { useEffect, useState } from 'react';

export default function StreamingPdfViewer({ 
  fileId, fileName, fileSize, isEncrypted, masterPassword 
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    const streamPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        if (isEncrypted) {
          // Encrypted: fetch full file
          const res = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              file_id: fileId, 
              master_password: masterPassword 
            })
          });
          
          if (!res.ok) throw new Error('Failed to fetch PDF');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setProgress(100);
        } else {
          // Unencrypted: stream with range requests
          await streamUnencryptedPdf();
        }
      } catch (err) {
        console.error('PDF streaming error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const streamUnencryptedPdf = async () => {
      const chunks = [];
      const chunkSize = 1024 * 1024; // 1MB
      let totalFetched = 0;

      for (let start = 0; start < fileSize; start += chunkSize) {
        const end = Math.min(start + chunkSize - 1, fileSize - 1);
        
        const res = await fetch(`/api/download?file_id=${fileId}`, {
          headers: { Range: `bytes=${start}-${end}` }
        });

        if (!res.ok) throw new Error(`Chunk fetch failed: ${res.status}`);

        const chunk = await res.blob();
        chunks.push(chunk);
        totalFetched += chunk.size;
        setProgress(Math.round((totalFetched / fileSize) * 100));
      }

      const fullBlob = new Blob(chunks, { type: 'application/pdf' });
      const url = URL.createObjectURL(fullBlob);
      setBlobUrl(url);
    };

    streamPdf();

    // Cleanup
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileId, fileSize, isEncrypted, masterPassword]);

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 text-red-600">
        <span>⚠️ Error: {error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-gray-600">{progress}% loaded</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="flex items-center justify-center text-gray-500">
        PDF URL not available
      </div>
    );
  }

  return (
    <div className="w-full h-[75vh] bg-gray-100 rounded border border-gray-200 overflow-hidden">
      <iframe
        src={blobUrl}
        className="w-full h-full"
        title={fileName}
        loading="lazy"
      />
    </div>
  );
}
```

### Step 2: Update PreviewModal.jsx

Replace PDF section:

```javascript
{file.mime_type?.includes('pdf') && (
    <StreamingPdfViewer 
      fileId={file.id}
      fileName={file.original_filename}
      fileSize={file.file_size}
      isEncrypted={file.is_encrypted}
      masterPassword={masterPassword}
    />
)}
```

Add import:
```javascript
import StreamingPdfViewer from './StreamingPdfViewer';
```

### Step 3: Test

1. Upload small PDF (< 10MB) → See immediate display + progress
2. Upload large PDF (50MB+) → See progress bar, responsive UI
3. Upload encrypted PDF → Works as before
4. Check network tab → Range requests being used

---

## Future: Phase 2 - HTTP Ranges

Enhance `/api/download` to return 206 Partial Content for PDFs:

```javascript
// app/api/download/route.js - existing endpoint
export async function GET(request) {
  // ... existing code ...
  
  const rangeHeader = request.headers.get('range');
  if (rangeHeader && !file.is_encrypted) {
    // NEW: Handle range for PDFs
    const bytes = parseRange(rangeHeader, file.file_size);
    if (bytes) {
      return streamPartialFile(file, bytes.start, bytes.end);
    }
  }
  
  // ... existing full download code ...
}

function parseRange(rangeHeader, fileSize) {
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return null;
  
  const start = parseInt(match[1], 10);
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
  
  return { start, end };
}
```

---

## Performance Expectations

### Before Optimization
```
100MB PDF upload:
- Click preview → 30 seconds loading
- Shows nothing until complete
- High memory usage
- Blocks UI
```

### After Phase 1 (Streaming Blob)
```
100MB PDF:
- Click preview → Progress bar starts
- First 1MB in ~2 seconds
- Can see status while loading
- Shows preview after ~10MB
- Responsive UI
```

### After Phase 2 (Range Requests)
```
100MB PDF (unencrypted):
- Click preview → Instant (just header)
- Pages 1-50 visible immediately
- Download pages as scrolling
- Only transfer needed bytes
- 80% bandwidth savings
```

### After Phase 3 (PDF.js)
```
100MB PDF (per-page):
- Click preview → Instant
- First page as image in 1 second
- Zoom/search/annotations
- Offline support
- Most professional UX
```

---

## Storage & Database Considerations

### Current Chunking (Good for Streaming)
```sql
files table:
  id, file_size, mime_type, ...

file_parts table:
  id, file_id, part_number, size, 
  telegram_file_id, iv, auth_tag
```

**No changes needed** - Existing structure supports streaming perfectly

### Optional Optimization
Add index for faster part lookups:
```sql
CREATE INDEX idx_file_parts_file_id ON file_parts(file_id);
```

---

## Security Considerations

### Encrypted PDFs
- Range requests don't work (must decrypt entire file)
- Use Approach 1 or 2
- Streaming blob hides encryption from user

### Unencrypted PDFs  
- Range requests are safe
- Use Approach 3 for best performance
- No sensitive data exposed

### CORS Headers (if needed)
```javascript
headers: {
  'Accept-Ranges': 'bytes',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Range'
}
```

---

## Recommendation Summary

**Start with Phase 1** (Streaming Blob - 2-3 hours):
- Easy implementation
- Immediate UX improvement
- Supports encrypted PDFs
- No new dependencies

**Then add Phase 2** (Range Requests - 1-2 hours):
- For unencrypted PDFs
- True streaming benefit
- Minimal code addition

**Optional Phase 3** (PDF.js - 1-2 days):
- Advanced features
- Best for premium tier
- Can implement later

---

## Files to Create/Modify

### Create
- `app/components/StreamingPdfViewer.jsx` (120 lines)

### Modify
- `app/components/PreviewModal.jsx` (5 lines)
- `app/api/download/route.js` (optional: add range support)

### No Database Changes Needed ✅

---

**Total Implementation Time: 2-4 hours (Phase 1)**  
**ROI: Excellent UX improvement for large PDF files**

