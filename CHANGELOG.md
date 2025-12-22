# Changelog

All notable changes to this project will be documented in this file.

## [2025-12-22] - Two-Layer Encryption for Personal S3 Credentials

### Added
- **Secure Personal S3 Configuration** - Users can now securely store personal S3/R2 credentials in the database, encrypted with their Master Password.
- **Two-Layer Encryption Flow** - Browser decrypts S3 config with Master Password, re-encrypts with server's RSA-4096 public key, server decrypts with private key (ephemeral, never persisted).
- **Server RSA Key Pair** - Automatic generation and secure storage of 4096-bit RSA key pair for S3 credential encryption in transit.
- **Per-User S3 Configuration Priority** - Upload/download logic respects priority: Personal S3 (user-configured) > Global S3 (env vars).
- **Encrypted S3 Config Endpoint** - `/api/encryption/public-key` returns server's RSA public key for browser to re-encrypt credentials.
- **Upload S3 Config Endpoint** - `/api/upload/s3-config` returns user's encrypted S3 config (encrypted with Master Password) for browser decryption.
- **Browser S3 Config Encryption** - `browserS3ConfigEncryption.js` provides `encryptS3ConfigWithServerKey()` and `decryptS3ConfigWithMasterPassword()` utilities.
- **Server-Side S3 Config Caching** - Per-upload cache (TTL: 30 min) prevents credential decryption for every chunk, improving performance.
- **Download S3 Fallback with Personal Config** - Browser can send re-encrypted personal S3 config via `X-S3-Config` header for S3 fallback during downloads.
- **Browser-Side S3 Config Caching** - Download operations cache re-encrypted S3 config (TTL: 5 min) to avoid duplicate API calls and re-encryption.
- **Security Properties** - Master password never sent to server; S3 credentials only exist in server memory during active use; two-layer encryption protects credentials in transit.

### Technical Details
- New module: `lib/encryption/rsaKeyManager.js` - manages server's RSA key pair (generation, loading, encryption/decryption).
- New module: `lib/browserS3ConfigEncryption.js` - browser-side S3 config encryption utilities using Web Crypto API.
- New API: `/api/encryption/public-key` (GET) - returns RSA public key (no auth required).
- New API: `/api/upload/s3-config` (GET) - returns user's encrypted S3 config (auth required).
- Updated API: `/api/upload/chunk` (POST) - accepts `s3_config_reencrypted` on first chunk, caches decrypted config per fileId.
- Updated API: `/api/chunk/[fileId]/[partNumber]` (GET) - accepts `X-S3-Config` header for S3 fallback during download.
- Updated module: `lib/browserUploadEncryption.js` - fetches encryption salt, decrypts S3 config with Master Password, re-encrypts with server key.
- Updated module: `lib/clientDecryption.js` - prepares S3 config once per download operation with browser-level caching.
- Updated components: FileCard, FileRow, Lightbox, SecureImage, ShareModal - pass `masterPassword` to decryption functions.
- Environment variables: `KEY_STORAGE_PATH` (default: `./.keys`) for RSA key storage.

### Bug Fixes
- Fixed S3 config encryption salt not being passed during browser decryption (now fetches from `/api/settings`).
- Fixed only first chunk uploading to personal S3 (implemented per-fileId server-side cache).
- Fixed multiple chunks overwriting same S3 object (now uses `userId/fileId/filename` as object key).
- Fixed RSA key manager not initialized during download (added init check at start of chunk download handler).
- Fixed duplicate API calls to `/api/settings` and `/api/upload/s3-config` (implemented 5-min browser-level cache).

### Blob Cache Improvements
- Added `getCachedOrDecrypt()` function in `lib/secureImageCache.js` to deduplicate concurrent decryption requests for the same file.
- Prevents multiple components from simultaneously fetching/decrypting the same file, reducing memory usage and API calls.
- Components wait for a single promise instead of creating multiple concurrent requests.

---

## [2025-12-21] - S3/R2 Backup Storage Support

### Added
- **S3/R2 Backup Storage** - Files are now optionally mirrored to S3-compatible storage (AWS S3, Cloudflare R2) for high availability.
- **Dual-Upload Engine** - Chunks uploaded to Telegram (primary) are automatically mirrored to S3 backup (non-blocking).
- **Fallback Download Logic** - Downloads retry Telegram 3x with exponential backoff before falling back to S3 backup.
- **Hierarchical Configuration** - S3 backups support Global (env), Organization, and Personal (encrypted) configuration levels.
- **Encrypted Credentials** - Personal S3 configs are encrypted using the user's Master Password (unrecoverable if lost).
- **Storage Class Support** - Choose from AWS S3 classes (Standard, IA, Intelligent-Tiering, Glacier) or R2 classes (Standard, IA).
- **Private by Default** - All S3 uploads explicitly use `ACL: 'private'` and downloads use 1-hour presigned URLs.

### Technical Details
- New entities: `Organization` for group-level S3 configs.
- Updated entities: `FilePart` (backup_storage_id, backup_backend), `User` (organization_id, encrypted_s3_config).
- New service: `S3ConfigService` for master-password encryption/decryption.
- New provider: Real `S3StorageProvider` with hierarchical credential selection.
- New API: `/api/settings/backup` (GET/POST/DELETE) for user backup config management.
- New UI: `S3BackupModal.jsx` for configuring backup storage (provider, bucket, credentials, storage class).
- Environment variables: `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_STORAGE_CLASS`, `ALLOW_PERSONAL_S3`.

---

## [2025-12-21] - Resumable Upload Support

### Added
- **Resumable Upload System** - Upload interruptions can now be resumed from where they left off without re-uploading completed chunks.
- **Deterministic Chunk Planning** - Browser generates random chunk sizes once and saves the plan to database; resume uses exact same sizes (no variance).
- **Upload Resume Detection** - `/api/upload/check` endpoint checks for incomplete uploads and identifies missing chunks.
- **Chunk Plan Retrieval** - `/api/upload/chunk-plan` endpoint provides saved chunk sizes for resuming uploads.
- **Resume Test Suite** - `test-resume.js` validates chunk plan generation, resume detection, partial uploads, and multiple resume cycles (6/6 tests passing).

### Technical Details
- Chunk plan stored as JSONB array in database: `[2.5MB, 2.7MB, 2.3MB, ..., 1.1MB]`
- Browser-side: generates plan once on new upload, retrieves and reuses on resume
- Server-side: saves plan on first chunk, prevents duplicate chunk processing via idempotency
- Resume detection based on filename + file size matching + incomplete upload status

---

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
