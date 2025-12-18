# Changes Made to Fix "Files Not Showing After Login"

## Summary
Fixed authentication and file ownership tracking in the upload system.

## File 1: `lib/apiAuth.js`
**Purpose:** Session cookie reading for API endpoints

**Changes:**
- Added defensive checks for `request.cookies` object
- Verify `get()` method exists before calling it
- Better error handling with try-catch

**Code:**
```javascript
// Before: Unsafe access
const sessionCookie = request.cookies.get('session_user')?.value;

// After: Safe with checks
if (request.cookies && typeof request.cookies.get === 'function') {
  sessionCookie = request.cookies.get('session_user')?.value;
}
```

---

## File 2: `lib/auth.js`
**Purpose:** Authentication for API routes

**Changes:**
1. Added `getUserFromSession()` function
   - Extracts user from `session_user` cookie
   - Decodes base64-encoded JSON
   - Returns user object with id and username

2. Enhanced `requireAuth()` function
   - Now extracts user from session first
   - Returns user object in response
   - Maintains backwards compatibility with session_token

**Code:**
```javascript
// New function
export function getUserFromSession(request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  
  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => c.split('='))
  );
  
  const sessionCookie = cookies['session_user'];
  if (!sessionCookie) return null;
  
  try {
    const decoded = Buffer.from(decodeURIComponent(sessionCookie), 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error('[auth.js] Failed to decode session_user:', err);
    return null;
  }
}

// Enhanced function
export async function requireAuth(request) {
  // ... setup checks ...
  
  const user = getUserFromSession(request);
  if (user && user.id) {
    return { authenticated: true, user };  // Now returns user!
  }
  
  // ... fallback to session_token ...
}
```

---

## File 3: `app/api/upload/chunk/route.js`
**Purpose:** Handle chunked file uploads

**Changes:**
1. Added imports for file utilities
2. Extract userId from auth response
3. Validate userId exists (required)
4. Pass userId to file creation
5. Include all required fields: user_id, file_type, mime_type, telegram_file_id

**Code:**
```javascript
// Added imports
import { getFileExtension, getMimeType } from '@/lib/utils';

// Extract user ID
const userId = auth.user?.id;
if (!userId) {
  console.error('[UPLOAD/CHUNK] User ID missing from auth');
  return NextResponse.json({ error: 'User identification failed' }, { status: 401 });
}

// When creating file
if (part_number === 1) {
  const fileExt = getFileExtension(original_filename);
  const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';
  
  if (!userId) {
    console.error('[UPLOAD/CHUNK] Cannot create file without user_id');
    return NextResponse.json({ 
      error: 'User identification required. Please log in and try again.' 
    }, { status: 401 });
  }
  
  fileRecord = await createFile({
    id: file_id,
    user_id: userId,  // ← CRITICAL FIX
    folder_id: folder_id || null,
    telegram_file_id: null,
    original_filename,
    file_size: decryptedSize * total_parts,
    file_type: fileExt,  // ← WAS MISSING
    mime_type: mimeType,
    is_encrypted: true,
    encryption_algo: 'AES-256-GCM'
  });
}
```

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| lib/apiAuth.js | Safe cookie reading | Fixed 401 auth errors on API calls |
| lib/auth.js | User extraction + return | Enabled userId to be passed to upload |
| app/api/upload/chunk/route.js | Pass userId to DB | Files now have correct user_id |

---

## Before & After

### Before Fix
```
User Login → Gets session_user cookie ✓
API Request → 401 Unauthorized ✗
File Upload → user_id = NULL ✗
List Files → No results ✗
```

### After Fix
```
User Login → Gets session_user cookie ✓
API Request → Authenticated ✓
File Upload → user_id = '069d49f9...' ✓
List Files → Shows uploaded files ✓
```
