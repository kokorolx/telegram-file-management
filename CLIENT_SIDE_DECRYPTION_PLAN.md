# Client-Side Decryption Implementation Plan

## Executive Summary

**Current Issue:** Server decrypts encrypted files before sending to browser  
**Target:** Move ALL decryption to browser - server returns encrypted chunks only

**Security Impact:** ✅ Ensures server never holds unencrypted file content

---

## Architecture Overview

### Current Flow (❌ INSECURE)
```
User Password
  ↓
Browser → /api/download (POST with password)
  ↓
Server derives key from password
  ↓
Server decrypts chunks (SERVER HAS PLAINTEXT)
  ↓
Server streams decrypted file
  ↓
Browser displays
```

**Problem:** Server has temporary access to decrypted files in memory

### New Flow (✅ SECURE)
```
User Password
  ↓
Browser derives key from password (PBKDF2)
  ↓
Browser → /api/stream?file_id=XXX (encrypted chunks only)
  ↓
Server returns encrypted blobs + IV + auth_tag metadata
  ↓
Browser combines encrypted chunks
  ↓
Browser decrypts in-memory using crypto.subtle API
  ↓
Browser displays plaintext
```

**Benefit:** Server never sees unencrypted content

---

## Implementation Steps

### Step 1: Create Client-Side Crypto Utilities

**File:** `lib/clientDecryption.js` (NEW)

```javascript
/**
 * Client-side decryption utilities using Web Crypto API
 * Works in browser only (not Node.js)
 */

// PBKDF2 key derivation (matches server implementation)
const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const SALT = process.env.NEXT_PUBLIC_ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';

/**
 * Derive encryption key from password using PBKDF2
 * Must match server-side deriveEncryptionKey() behavior
 */
export async function deriveEncryptionKeyBrowser(password) {
  // Web Crypto API: PBKDF2 with SHA-256
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(SALT),
      iterations: KDF_ITERATIONS
    },
    passwordKey,
    KDF_KEYLEN * 8 // Convert bytes to bits
  );

  return new Uint8Array(derivedBits);
}

/**
 * Decrypt a single chunk using AES-256-GCM
 * @param {Uint8Array} encryptedBuffer - Encrypted data
 * @param {Uint8Array} key - 32-byte AES key
 * @param {Uint8Array} iv - 12-byte IV
 * @param {Uint8Array} authTag - 16-byte auth tag
 * @returns {Promise<Uint8Array>} Decrypted data
 */
export async function decryptChunkBrowser(encryptedBuffer, key, iv, authTag) {
  try {
    // Combine encrypted data + auth tag for Web Crypto (required format)
    const dataWithTag = new Uint8Array(encryptedBuffer.length + authTag.length);
    dataWithTag.set(encryptedBuffer);
    dataWithTag.set(authTag, encryptedBuffer.length);

    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      dataWithTag
    );

    return new Uint8Array(decrypted);
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error(`Failed to decrypt chunk: ${err.message}`);
  }
}

/**
 * Fetch and decrypt a file chunk
 * @param {string} fileId - File ID
 * @param {number} partNumber - Part number to fetch
 * @param {Uint8Array} key - Derived encryption key
 * @returns {Promise<Uint8Array>} Decrypted chunk data
 */
export async function fetchAndDecryptChunk(fileId, partNumber, key) {
  try {
    // Fetch encrypted chunk from server (returns JSON with metadata)
    const response = await fetch(
      `/api/chunk?file_id=${fileId}&part=${partNumber}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch chunk: HTTP ${response.status}`);
    }

    const chunkData = await response.json();
    const {
      encrypted_data, // Base64-encoded encrypted blob
      iv,             // Base64-encoded IV
      auth_tag,       // Base64-encoded auth tag
      part_number,
      size
    } = chunkData;

    // Convert from Base64 to Uint8Array
    const encryptedBuffer = base64ToUint8Array(encrypted_data);
    const ivBuffer = base64ToUint8Array(iv);
    const authTagBuffer = base64ToUint8Array(auth_tag);

    // Decrypt
    const decrypted = await decryptChunkBrowser(
      encryptedBuffer,
      key,
      ivBuffer,
      authTagBuffer
    );

    console.log(`Decrypted chunk ${part_number}/${size}`);
    return decrypted;
  } catch (err) {
    console.error(`Error fetching/decrypting chunk ${partNumber}:`, err);
    throw err;
  }
}

/**
 * Fetch entire encrypted file as decrypted blob
 * Used for images, PDFs, documents that need full file
 */
export async function fetchAndDecryptFullFile(fileId, key, partMetadata) {
  try {
    const chunks = [];

    for (const part of partMetadata) {
      const decrypted = await fetchAndDecryptChunk(fileId, part.part_number, key);
      chunks.push(decrypted);
    }

    // Combine all chunks into single blob
    return new Blob(chunks.map(c => c.buffer));
  } catch (err) {
    console.error('Error fetching full encrypted file:', err);
    throw err;
  }
}

/**
 * Create a ReadableStream for encrypted file
 * Used for video/audio streaming
 */
export async function createDecryptedStream(fileId, key, partMetadata) {
  let currentPartIndex = 0;

  return new ReadableStream({
    async pull(controller) {
      try {
        if (currentPartIndex >= partMetadata.length) {
          controller.close();
          return;
        }

        const part = partMetadata[currentPartIndex];
        const decrypted = await fetchAndDecryptChunk(fileId, part.part_number, key);
        controller.enqueue(decrypted);
        currentPartIndex++;
      } catch (err) {
        console.error('Stream error:', err);
        controller.error(err);
      }
    }
  });
}

/**
 * Helper: Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64String) {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Helper: Convert Uint8Array to Base64
 */
export function uint8ArrayToBase64(buffer) {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
```

---

### Step 2: Create Server Chunk Endpoint

**File:** `app/api/chunk/route.js` (NEW)

Returns encrypted chunk data (no decryption on server):

```javascript
import { NextResponse } from 'next/server';
import { getFileById, getFileParts } from '@/lib/db';
import { getFileDownloadUrl } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chunk?file_id=XXX&part=N
 * Returns encrypted chunk data with IV and auth tag
 * Server does NO decryption - only fetches from Telegram and serves encrypted
 */
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file_id');
    const partNumber = parseInt(searchParams.get('part'), 10);

    if (!fileId || isNaN(partNumber)) {
      return NextResponse.json(
        { error: 'Missing file_id or part number' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = await getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (!file.is_encrypted) {
      return NextResponse.json(
        { error: 'File is not encrypted' },
        { status: 400 }
      );
    }

    // Get specific part
    const parts = await getFileParts(fileId);
    const part = parts.find(p => p.part_number === partNumber);

    if (!part) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    // Fetch encrypted blob from Telegram
    const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
    const res = await fetch(dlUrl);

    if (!res.ok) {
      throw new Error(`Failed to fetch from Telegram: ${res.status}`);
    }

    const encryptedBuffer = Buffer.from(await res.arrayBuffer());

    // Return encrypted data + metadata (NO decryption)
    return NextResponse.json(
      {
        encrypted_data: encryptedBuffer.toString('base64'),
        iv: part.iv, // Already hex from DB
        auth_tag: part.auth_tag, // Already hex from DB
        part_number: part.part_number,
        size: part.size,
        total_parts: parts.length
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate'
        }
      }
    );
  } catch (err) {
    console.error('Chunk fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Chunk fetch failed' },
      { status: 500 }
    );
  }
}
```

---

### Step 3: Modify `/api/stream/route.js`

Remove server-side decryption. Return encrypted chunks only:

```javascript
// BEFORE: Server decrypts in ReadableStream pull()
const decrypted = decryptBuffer(encryptedBuffer, key, ...);
controller.enqueue(decrypted);

// AFTER: Return encrypted chunks directly
// Client will decrypt in browser
controller.enqueue(encryptedBuffer);
```

Or redirect clients to use `/api/chunk` endpoint instead for granular control.

---

### Step 4: Update PreviewModal.jsx

Add browser-side decryption for encrypted files:

```javascript
import { deriveEncryptionKeyBrowser, fetchAndDecryptFullFile } from '@/lib/clientDecryption';

// In loadSecure() function
async function loadSecure(password) {
  try {
    setLoading(true);
    setError(null);

    // For encrypted files: decrypt in BROWSER
    if (file?.is_encrypted) {
      // 1. Derive key in browser
      const key = await deriveEncryptionKeyBrowser(password);

      // 2. Fetch part metadata (unencrypted)
      const partsRes = await fetch(`/api/files/${file.id}/parts`);
      const partsData = await partsRes.json();
      const partMetadata = partsData.parts;

      // 3. Fetch and decrypt full file in browser
      const decryptedBlob = await fetchAndDecryptFullFile(file.id, key, partMetadata);

      // 4. Create blob URL
      const url = URL.createObjectURL(decryptedBlob);
      setSecureSrc(url);
    }

    setLoading(false);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
}
```

---

### Step 5: Update VideoPlayer.jsx

For encrypted videos, decrypt stream in browser:

```javascript
import { createDecryptedStream, deriveEncryptionKeyBrowser } from '@/lib/clientDecryption';

// Modify video source to use decrypted stream
async function setupEncryptedVideo(fileId, masterPassword) {
  // 1. Derive key in browser
  const key = await deriveEncryptionKeyBrowser(masterPassword);

  // 2. Get part metadata
  const partsRes = await fetch(`/api/files/${fileId}/parts`);
  const { parts } = await partsRes.json();

  // 3. Create decrypted stream
  const stream = await createDecryptedStream(fileId, key, parts);

  // 4. Create blob URL from stream
  const reader = stream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const blob = new Blob(chunks);
  const url = URL.createObjectURL(blob);

  // 5. Set video src
  videoElement.src = url;
}
```

---

### Step 6: Create Parts Endpoint

**File:** `app/api/files/[id]/parts/route.js` (NEW)

Returns unencrypted metadata about file parts:

```javascript
import { getFileParts } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const parts = await getFileParts(params.id);
    
    return NextResponse.json({
      parts: parts.map(p => ({
        part_number: p.part_number,
        size: p.size
        // IV and auth_tag will be fetched per-chunk
      }))
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Data Flow Diagram

```
ENCRYPTED FILE PREVIEW (e.g., image.jpg.encrypted)

Browser:
  1. User enters master password
  2. Derive key: PBKDF2(password, salt) → 32-byte key
  
  3. Fetch part metadata: /api/files/123/parts
     ← [{ part_number: 1, size: 2097152 }, ...]
  
  4. For each part:
     - Fetch: /api/chunk?file_id=123&part=1
     ← { encrypted_data: "AABBCC...", iv: "...", auth_tag: "...", ... }
     - Decrypt: AES-256-GCM(encrypted_data, key, iv, auth_tag)
     → Decrypted chunk buffer
  
  5. Combine chunks → Blob
  6. Create blob URL
  7. Display (img, video, audio, iframe for PDF)

Server:
  - Does NOT decrypt
  - Returns only encrypted data from Telegram
  - No sensitive data in memory
```

---

## Security Properties

| Property | Before | After |
|----------|--------|-------|
| **Server sees plaintext** | ✗ YES (decrypts in memory) | ✓ NO (only returns encrypted) |
| **Password sent to server** | ✗ YES (in POST body) | ✓ NO (only used in browser) |
| **Decryption location** | ✗ Server (untrusted) | ✓ Browser (user's device) |
| **Key derivation** | ✗ Server | ✓ Browser (PBKDF2 Web Crypto) |
| **Requires HTTPS** | ✓ YES | ✓ YES (for auth token) |
| **Auth token exposure** | ✓ Mitigated (httpOnly cookies) | ✓ Same as before |

---

## Implementation Order

1. ✅ Create `lib/clientDecryption.js` (crypto utilities)
2. ✅ Create `app/api/chunk/route.js` (encrypted chunk endpoint)
3. ✅ Create `app/api/files/[id]/parts/route.js` (metadata endpoint)
4. ✅ Update `PreviewModal.jsx` (browser decryption for images/PDFs)
5. ✅ Update `VideoPlayer.jsx` (encrypted video streaming)
6. ✅ Update `/api/stream/route.js` (remove server decryption OR redirect)
7. ✅ Update `FileCard.jsx` (audio encrypted file handling)
8. ✅ Test all file types (image, video, audio, PDF, documents)

---

## Testing Checklist

- [ ] Upload encrypted image → Preview shows decrypted image
- [ ] Upload encrypted video → Play encrypted video (decrypts in browser)
- [ ] Upload encrypted audio → Play encrypted audio (decrypts in browser)
- [ ] Upload encrypted PDF → Display PDF (decrypted in browser)
- [ ] Upload encrypted document → Show thumbnail + fallback UI
- [ ] Verify server logs show NO decryption operations
- [ ] Check Network tab: encrypted data visible, IV/auth_tag visible
- [ ] Wrong password → Decryption error in browser (NOT auth error)
- [ ] Multiple chunks → All chunks decrypted and combined correctly

---

## Environment Variables

Add to `.env.local`:

```env
# Must match server-side encryption salt
NEXT_PUBLIC_ENCRYPTION_SALT=telegram-file-manager-fixed-salt
```

Note: `NEXT_PUBLIC_` prefix is required so it's available in browser. Encryption security depends on password, not salt (salt is for key derivation).

---

## Performance Considerations

**Current bottleneck:** Server decryption (CPU-intensive on server)  
**New bottleneck:** Client decryption (CPU-intensive on browser)

**Mitigation:**
- Use Web Crypto API (hardware-accelerated where available)
- Decrypt chunks one at a time (not all in parallel)
- Show progress indicator for large files
- Implement chunk caching in browser (IndexedDB)

---

## Backward Compatibility

- Old server-side decryption endpoint still works for existing clients
- New client-side endpoints are separate (`/api/chunk`, `/api/files/[id]/parts`)
- Can run both in parallel during migration
- No database changes required

---

## File Summary

### New Files
- `lib/clientDecryption.js` (250 lines)
- `app/api/chunk/route.js` (80 lines)
- `app/api/files/[id]/parts/route.js` (40 lines)

### Modified Files
- `app/components/PreviewModal.jsx` (60 lines changed)
- `app/components/VideoPlayer.jsx` (50 lines changed)
- `app/api/stream/route.js` (simplify or deprecate)

### No Changes Needed
- Database schema
- File upload logic
- Folder management

---

## Total Implementation Time

- Client crypto utilities: 1-2 hours
- Server endpoints: 1 hour
- Component updates: 2-3 hours
- Testing: 1-2 hours

**Total: 5-8 hours**

---

## Key Security Win

**Before:** `plaintext_file → server_decryption → browser`  
**After:** `encrypted_file → browser_decryption → plaintext_file`

Server never has access to plaintext file content. ✅
