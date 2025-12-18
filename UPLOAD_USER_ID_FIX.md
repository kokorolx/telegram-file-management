# Upload User ID Fix - Files Not Showing After Upload

## Problem
When users uploaded files via the browser-side encrypted upload (chunked upload), the files were created in the database **without the user_id field**. This caused the uploaded files to be invisible to users because the `getFilesByFolder()` query filters by `user_id`.

**Example scenario:**
- User logs in successfully (authentication working)
- User creates a folder (folder shows up - user_id is correctly saved)
- User uploads a file via browser encryption (file is saved but without user_id)
- User navigates to folder - no files appear even though file exists in DB

## Root Causes

### Issue 1: Missing User Extraction in Chunk Upload
The `/api/upload/chunk` endpoint was using the old `requireAuth()` from `lib/auth.js` which:
- Only checked for valid session but didn't extract user information
- Returned no user data in the response

### Issue 2: Missing user_id Parameter
When creating files in the chunk endpoint, the `user_id` parameter was never passed to the `createFile()` function.

### Issue 3: Missing file_type Parameter
The chunk endpoint wasn't passing `file_type` to `createFile()`, which is required by the `insertFile()` function.

## Solution

### 1. Enhanced `lib/auth.js`
Added a new `getUserFromSession()` function that properly extracts user data from the `session_user` cookie:
```javascript
export function getUserFromSession(request) {
  // Reads and decodes session_user cookie
  // Returns user object with { id, username }
}
```

Updated `requireAuth()` to return user information:
- Now returns `{ authenticated: true, user: { id, username } }`
- Tries new `session_user` cookie first (modern auth)
- Falls back to old `session_token` for backwards compatibility

### 2. Fixed `/api/upload/chunk/route.js`
- Extract `userId` from the auth response
- Validate that user_id exists (required)
- Pass all required fields to `createFile()`:
  - `user_id` ← **KEY FIX**
  - `file_type` (extracted from filename)
  - `mime_type` (derived from file_type)
  - `telegram_file_id` (required field)

## Changes Made

### File: `lib/auth.js`
- Added `getUserFromSession(request)` function
- Enhanced `requireAuth()` to extract and return user object

### File: `app/api/upload/chunk/route.js`
- Import `getFileExtension` and `getMimeType` utilities
- Extract and validate `userId` from auth response
- Pass complete file data including `user_id`, `file_type`, `mime_type`, and `telegram_file_id`

## Verification

After these changes:
- ✅ Users can still log in
- ✅ Sessions are properly authenticated
- ✅ Folders are created with correct user_id
- ✅ **Files uploaded via browser encryption now have correct user_id**
- ✅ Files appear in the file list for authenticated users

## Impact

This fix ensures that:
1. All uploaded files are properly associated with the uploading user
2. Files are visible only to the user who uploaded them
3. Multi-user scenarios work correctly (each user sees only their files)
