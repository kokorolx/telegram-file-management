# Passport Authentication - Next Steps for Remaining Endpoints

## Overview
The core Passport authentication system has been implemented. The following endpoints need to be updated to support user ID isolation.

## Endpoints to Update

### 1. File Upload Endpoints

**Files:**
- `/app/api/upload/route.js` - Main file upload
- `/app/api/upload/chunk/route.js` - Chunked upload
- `/app/api/chunk/route.js` - Chunk processing

**Changes Needed:**
```javascript
// Add at start of POST handler:
import { getUserFromRequest } from '@/lib/apiAuth';

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !user.id) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // When inserting file, include user_id:
  const fileData = {
    id: fileId,
    user_id: user.id,  // ADD THIS
    folder_id: folderId,
    // ... rest of fields
  };
  
  await insertFile(fileData);
}
```

### 2. File/Folder Management Endpoints

**Files:**
- `/app/api/files/[id]/route.js` - Get/update/delete specific file
- `/app/api/folders/[id]/route.js` - Get/update/delete specific folder
- `/app/api/files/[id]/parts/route.js` - File parts management

**Changes Needed:**
- Extract user from session
- Verify user owns the resource before delete/update
- Filter queries by user_id

**Example:**
```javascript
import { getUserFromRequest } from '@/lib/apiAuth';
import { getFileById } from '@/lib/db';

export async function DELETE(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return unauthorized();

  const file = await getFileById(params.id);
  
  // Verify user owns this file
  if (file.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  // Delete file...
}
```

### 3. Download/Stream Endpoints

**Files:**
- `/app/api/download/route.js` - Download files
- `/app/api/stream/route.js` - Stream files
- `/app/api/stream/[fileId]/route.js` - File streaming
- `/app/api/stream/[fileId]/chunk/[chunkNum]/route.js` - Chunk streaming
- `/app/api/stream/[fileId]/manifest/route.js` - Stream manifest

**Changes Needed:**
- Verify user owns the file before serving
- Filter by user_id in queries

**Example:**
```javascript
export async function GET(request, { params }) {
  const user = getUserFromRequest(request);
  const file = await getFileById(params.fileId);

  // Verify ownership
  if (file.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  // Serve file...
}
```

### 4. Settings Endpoint

**Files:**
- `/app/api/settings/route.js`

**Note:** This endpoint handles global settings. It may not need user_id filtering, but verify its usage.

## Implementation Checklist

- [ ] Update `/app/api/upload/route.js` - Add user_id to insertFile
- [ ] Update `/app/api/upload/chunk/route.js` - Add user_id checks
- [ ] Update `/app/api/chunk/route.js` - Add user_id checks
- [ ] Update `/app/api/files/[id]/route.js` - Add ownership verification
- [ ] Update `/app/api/files/[id]/parts/route.js` - Add user_id filtering
- [ ] Update `/app/api/folders/[id]/route.js` - Add ownership verification
- [ ] Update `/app/api/download/route.js` - Add ownership verification
- [ ] Update `/app/api/stream/route.js` - Add ownership verification
- [ ] Update `/app/api/stream/[fileId]/route.js` - Add ownership verification
- [ ] Update `/app/api/stream/[fileId]/chunk/[chunkNum]/route.js` - Add ownership verification
- [ ] Update `/app/api/stream/[fileId]/manifest/route.js` - Add ownership verification
- [ ] Test all endpoints with different users
- [ ] Verify cross-user access is denied

## Testing

After updating each endpoint:

```bash
# Test as user 1
curl -X POST /api/auth/login -d '{"username":"user1","password":"pass1"}' -c user1.txt
curl /api/files -b user1.txt

# Test as user 2
curl -X POST /api/auth/login -d '{"username":"user2","password":"pass2"}' -c user2.txt
curl /api/files -b user2.txt  # Should NOT see user1's files

# Test cross-user access (should fail)
FILEID_USER1="..." # File ID from user1
curl /api/files/$FILEID_USER1 -b user2.txt  # Should return 403
```

## Key Functions

**Get user from request:**
```javascript
import { getUserFromRequest } from '@/lib/apiAuth';
const user = getUserFromRequest(request);
```

**Verify ownership:**
```javascript
if (resource.user_id !== user.id) {
  return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
}
```

**Query with user_id:**
```javascript
// Updated DB functions now require user_id:
const files = await getFilesByFolder(user.id, folderId);
const folders = await getFolders(user.id, parentId);
const allFiles = await getAllFiles(user.id);
```

## Database Functions Reference

All file/folder DB functions now require `user_id` as first parameter:

```javascript
// Files
getFileById(id) - returns file object with user_id field
getFile(fileId) - returns file object with user_id field
getFilesByFolder(userId, folderId) - filtered by user
getAllFiles(userId) - filtered by user
insertFile(fileData) - requires user_id in fileData
moveFile(fileId, targetFolderId) - add user verification
deleteFile(id) - add user verification

// Folders
createFolder(folderId, userId, name, parentId) - requires userId
getFolders(userId, parentId) - filtered by user
getFoldersByParent(userId, parentId) - filtered by user
getAllFolders(userId) - filtered by user
getFolderById(folderId) - returns folder with user_id field
getFolderByPath(userId, pathStr) - requires userId
renameFolder(folderId, newName) - add user verification
deleteFolder(folderId) - add user verification
moveFolder(folderId, targetParentId) - add user verification
```

## Files Modified So Far

✓ `package.json` - Added Passport dependencies
✓ `lib/passport.js` - Created Passport configuration
✓ `lib/apiAuth.js` - Created auth helper functions
✓ `lib/sessionHelper.js` - Created session helpers
✓ `lib/db.js` - Updated all functions for user_id support
✓ `middleware.js` - Updated session validation
✓ `/app/api/auth/login/route.js` - Updated with session support
✓ `/app/api/auth/logout/route.js` - Created logout endpoint
✓ `/app/api/files/route.js` - Updated with user filtering
✓ `/app/api/folders/route.js` - Updated with user filtering

## Documentation

✓ `PASSPORT_AUTHENTICATION.md` - Complete guide
✓ `PASSPORT_IMPLEMENTATION_NEXT_STEPS.md` - This file
