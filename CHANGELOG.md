# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- **Path-based chunk download API** - Converted `/api/chunk?file_id=X&part=Y` to `/api/chunk/[fileId]/[partNumber]` for better caching support
- **Browser caching for chunks** - Encrypted chunks now cached for 1 year with `immutable` flag since content never changes
- **Immediate login feedback** - User context now refreshes immediately after login without requiring page reload

### Changed
- **Cache-Control headers** - Changed from `no-cache, no-store, must-revalidate` to `max-age=31536000, immutable` for encrypted chunks
- **LoginDialog integration** - `handleLoginSuccess()` now calls `checkAuth()` to update user state immediately

### Deprecated
- **Query parameter chunk endpoint** - `/api/chunk?file_id=X&part=Y` now returns 410 Gone, use path-based endpoint instead

### Fixed
- **Login UI not updating** - Fixed race condition where username wasn't displayed after login until page refresh

---

## [Previous Session] - Session-based Authentication & Upload Encryption

### Added
- **Session-based authentication** - User authentication via base64-encoded `session_user` cookie
- **UserContext** - Centralized user state management with `useUser()` hook
- **Login/Logout UI** - Added login dialog and logout button in header
- **Auth endpoint** - `/api/auth/me` to verify current user session
- **Browser-side file encryption** - Files encrypted with AES-256-GCM in browser before upload
- **Chunked upload system** - Large files split into 1-5MB chunks for upload
- **Upload cancellation** - AbortController integration for cancellable uploads
- **Encrypted chunk storage** - Chunks stored in database with IV and auth_tag for client-side decryption
- **File ownership** - All files now properly associated with user_id

### Fixed
- **Critical auth bug** - API endpoints weren't reading session cookies, causing 401 errors even after login
- **File visibility issue** - Uploaded files weren't appearing because they lacked user_id field
- **File creation in upload endpoint** - Now extracts userId from auth and passes to file creation
- **Cancelled upload queue handling** - Files properly removed from queue when cancelled

### Technical Details
- Session authentication: Session data stored in `session_user` cookie as base64-encoded JSON
- Encryption: PBKDF2 key derivation (100000 iterations) with AES-256-GCM
- Chunk metadata: IV and auth_tag stored in `file_parts` table, encrypted data in Telegram
- Upload flow: Browser encrypts → sends chunks to `/api/upload/chunk` → chunks uploaded to Telegram → metadata stored in DB

---

## Architecture Overview

### Authentication Flow
1. User submits username + password to `/api/auth/login`
2. Server creates `session_user` cookie with `{ id, username }`
3. API endpoints read cookie via `getUserFromRequest()` in lib/apiAuth.js
4. UserContext verifies session via `/api/auth/me` endpoint on app load
5. After login, `checkAuth()` refreshes context immediately

### File Upload Flow
1. User selects file(s) to upload
2. UploadForm encrypts file chunks in browser using master password
3. Each chunk sent to `/api/upload/chunk` with encrypted_data, iv, auth_tag
4. Server creates file record (first chunk only) with user_id
5. Each chunk uploaded to Telegram as-is (encrypted)
6. Chunk metadata stored in `file_parts` table (no plaintext stored)

### File Download/Streaming Flow
1. Client requests chunk from `/api/chunk/[fileId]/[partNumber]`
2. Server fetches encrypted chunk from Telegram
3. Server returns base64 encrypted data + metadata (iv, auth_tag)
4. Client-side browser decrypts chunk using Web Crypto API
5. Browser combines chunks into original file (for full file) or streams (for video/audio)

---

## Files Modified

### Frontend
- `app/[[...folderPath]]/page.jsx` - Main page, auth state integration
- `app/components/UploadForm.jsx` - File upload with browser-side encryption
- `app/components/LoginDialog.jsx` - Login/register UI
- `app/contexts/UserContext.js` - User state management
- `lib/clientDecryption.js` - Client-side decryption utilities
- `app/components/VideoPlayer.jsx` - Video streaming with chunk decryption
- `app/layout.jsx` - Root layout with UserProvider

### Backend
- `lib/apiAuth.js` - Session cookie extraction for API endpoints
- `lib/auth.js` - Authentication helpers and session management
- `app/api/auth/me/route.js` - Current user endpoint
- `app/api/auth/login/route.js` - User login endpoint
- `app/api/auth/register/route.js` - User registration endpoint
- `app/api/auth/logout/route.js` - User logout endpoint
- `app/api/upload/chunk/route.js` - Encrypted chunk upload handler
- `app/api/chunk/[fileId]/[partNumber]/route.js` - Encrypted chunk download (path-based)
- `app/api/files/route.js` - File listing with user filtering
- `app/api/folders/route.js` - Folder management with user filtering

### Utilities
- `lib/browserUploadEncryption.js` - Browser-side encryption for uploads
- `lib/db.js` - Database functions (file, folder, chunk operations)

---

## Known Limitations

1. **Orphaned chunks on cancel** - Cancelled uploads leave partial chunks in database (cleanup needed)
2. **No resume capability** - Cancelled uploads cannot be resumed
3. **Single user per device** - No multi-user session support yet
4. **Master password requirement** - All uploads require master password entry (no unlock persistence)

---

## Next Steps / TODO

- [ ] Cleanup orphaned chunks from cancelled uploads
- [ ] Add file deletion functionality
- [ ] Add batch operations (multi-select delete/move)
- [ ] Add more granular upload progress tracking
- [ ] Implement upload resume capability
- [ ] Add file sharing with expiring links
- [ ] Add file versioning
