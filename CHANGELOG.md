# Changelog

All notable changes to this project will be documented in this file.

## [2025-12-19] - Secure Sharing & Envelope Encryption

### Added
- **Envelope Encryption Architecture** - Migrated from "Direct Encryption" to "Envelope Encryption" (DEK-KEK model). Each file now has a unique Data Encryption Key (DEK), providing significantly better security and instant sharing.
- **Secure Instant Sharing** - Users can now generate secret sharing links instantly (no re-encryption required). Supports custom passwords and automatic expiration (1, 7, 30 days).
- **Public Guest Share Page** - Secure interface for recipients to decrypt and preview shared files using secret URL tokens or passwords without an account.
- **Legacy Migration System** - One-click "Security Upgrade" for existing files to bridge them from the old encryption model to the new Envelope model.
- **Optimized Key Derivation** - Drastically improved performance by reusing pre-derived master key bits from the context, eliminating redundant PBKDF2 iterations during sharing and preview.
- **BigInt Support for Large Files** - Updated DB schema to handle file sizes exceeding 2.1GB (switched `INTEGER` to `BIGINT`).
- **Fresh Logout Policy** - UI now completely hides and clears all files, folders, and metadata when the user logs out.
- **Auto-Locking Vault** - Encryption vault now automatically locks and revokes all in-memory decrypted blobs (videos, images) on logout.

### Changed
- **Shared Link Persistence** - New `SharedLink` entity and repository for managing sharing metadata and usage stats.
- **Core Decryption Logic** - Unified `getDEK` helper added to handle both legacy (Direct) and new (Envelope) encryption versions seamlessly.
- **Thumbnail Rendering** - `SecureImage` and `FileCardThumbnail` now use the Envelope model for faster rendering of encrypted previews.

### Fixed
- **Upload Race Condition** - Ensured sequential processing of the first file chunk to prevent "Failed to create or retrieve file" errors during parallel uploads.
- **Unauthorized File Access** - Removed insecure legacy `session_token` fallbacks; validated every file request against active user sessions.
- **Video Decryption Error** - Fixed `CryptoKey` type mismatch in the browser.
- **Multi-Bot Resolution** - Correctly threaded `userId` through `fileService.js` to ensure files reach the correct Telegram bot.
- **Login UI not updating** - Fixed race condition where username wasn't displayed after login until page refresh.
- **Legacy Password Preview** - Fixed issue where legacy-encrypted files triggered a download on unlock instead of previewing, and clarified unlock instructions.

---

## [2025-12-18] - Browser-Side Decryption & Binary Streaming

### Added
- **Zero-Knowledge Key Management** - Server returns user-specific `encryption_salt` during unlock; browser derives key locally in RAM.
- **Binary Chunk Delivery** - `/api/chunk` now returns raw binary data (`application/octet-stream`) instead of Base64 JSON.
- **Cryptographic Metadata in Parts API** - `/api/files/[id]/parts` now exposes `iv` and `auth_tag` for efficient client-side lookup.
- **Improved Caching** - Binary chunks are marked as `immutable` for 1 year; decrypted blobs are cached in a per-session `blobCache`.
- **Parallel Decryption** - Downloads and previews now fetch and decrypt multiple chunks simultaneously for better performance.

### Changed
- **EncryptionContext** - Now manages derived `encryptionKey` and `salt` in browser RAM, eliminating redundant re-derivation.
- **Download API (POST)** - No longer requires master password; client now handles full decryption using locally derived key.
- **Secure Components** - `SecureImage`, `FileRow`, `PreviewModal`, and `VideoPlayer` refactored to use the new decentralized decryption flow.
- **Setup Flow** - `SetupModal` now automatically unlocks the vault and derives the key immediately after setting a master password.

### Fixed
- **Video Playback Performance** - Removed Base64 decoding overhead; video player now streams raw binary chunks directly.
- **Streaming Logic** - Fixed regression in `createDecryptedStream` to properly handle new metadata format.

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
1. Client requests metadata from `/api/files/[id]/parts` (returns all IVs/AuthTags).
2. Client requests raw encrypted chunks from `/api/chunk/[fileId]/[partNumber]`.
3. Server fetches encrypted chunk from Telegram and streams raw binary data.
4. Client-side browser decrypts chunk using Web Crypto API and locally stored derived key.
5. Browser combines chunks into original file or streams them via `createDecryptedStream`.

---

## Files Modified

### Frontend
- `app/[[...folderPath]]/page.jsx` - Main page, auth state integration
- `app/components/UploadForm.jsx` - File upload with browser-side encryption
- `app/components/LoginDialog.jsx` - Login/register UI
- `app/contexts/UserContext.js` - User state management
- `lib/clientDecryption.js` - Client-side decryption with parallel fetching and raw binary support
- `app/components/VideoPlayer.jsx` - Refactored for binary streaming and shared encryption context
- `app/components/SecureImage.jsx` - Updated for browser-side blob assembly
- `app/components/FileRow.jsx` - Updated for decentralized file downloads
- `app/contexts/EncryptionContext.js` - Expanded to manage derived keys and salts
- `app/components/PreviewModal.jsx` - Unified decryption for images, audio, and documents
- `app/components/SetupModal.jsx` - Integrated with unlock flow
- `app/components/FolderNav.jsx` - Captured salt and triggered context unlock
- `app/layout.jsx` - Root layout with UserProvider

### Backend
- `lib/apiAuth.js` - Session cookie extraction for API endpoints
- `lib/auth.js` - Authentication helpers and session management
- `app/api/auth/me/route.js` - Current user endpoint
- `app/api/auth/login/route.js` - User login endpoint
- `app/api/auth/register/route.js` - User registration endpoint
- `app/api/auth/logout/route.js` - User logout endpoint
- `app/api/upload/chunk/route.js` - Encrypted chunk upload handler
- `app/api/auth/verify-master/route.js` - Returns encryption salt on success
- `app/api/settings/route.js` - Returns salt on setup/password change
- `app/api/chunk/[fileId]/[partNumber]/route.js` - Raw binary chunk delivery
- `app/api/files/[id]/parts/route.js` - Included cryptographic metadata (iv, auth_tag)
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
4. **Browser Memory Usage** - Assembling very large files (>1GB) in-browser may require significant RAM.
5. **No resume capability** - Cancelled uploads/downloads cannot be resumed easily yet.

---

## Next Steps / TODO

- [ ] Cleanup orphaned chunks from cancelled uploads
- [ ] Add file deletion functionality
- [ ] Add batch operations (multi-select delete/move)
- [ ] Add more granular upload progress tracking
- [ ] Implement upload resume capability
- [x] Add file sharing with expiring links
- [ ] Add file versioning
