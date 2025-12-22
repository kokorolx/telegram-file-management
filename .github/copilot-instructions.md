# Telegram File Management - AI Coding Instructions

## Core Architecture

### Zero-Knowledge Encryption Model
- **Critical Security Principle**: All encryption/decryption happens EXCLUSIVELY in the browser. The server NEVER sees unencrypted content or the master password.
- **Key Derivation**: Uses PBKDF2 (100,000 iterations, SHA-256) to derive a 256-bit AES key from the master password + user-specific salt.
- **Encryption Key Lifecycle**: The encryption key lives only in browser RAM via [app/contexts/EncryptionContext.js](app/contexts/EncryptionContext.js). On logout or browser close, it's destroyed.
- **Chunk Encryption**: Files are split into random-sized chunks (2-3MB) and each chunk is encrypted with AES-256-GCM using a unique IV (12 bytes) and auth tag (16 bytes).

### Storage Architecture
- **Primary Storage**: Telegram Bot API stores encrypted chunks as documents. Each chunk returns a `telegram_file_id` (opaque identifier).
- **Dual-Upload Support**: Optional S3/R2 backup configured per-user. See [app/api/upload/chunk/route.js](app/api/upload/chunk/route.js) for dual-upload implementation.
- **Metadata Database**: PostgreSQL stores file metadata (filename, size, MIME type), chunk metadata (IVs, auth tags, `telegram_file_id`), and folder structure. See [docs/DATABASE.md](docs/DATABASE.md) for schema details.

### Service-Repository Pattern
- **Business Logic**: Lives in [lib/services/](lib/services/) (e.g., `FileService`, `RecoveryCodeService`, `StatsService`).
- **Data Access**: Handled by repositories in [lib/repositories/](lib/repositories/). All repos extend [lib/repositories/BaseRepository.js](lib/repositories/BaseRepository.js).
- **Entities**: TypeORM entities in [lib/entities/](lib/entities/) define database schema.
- **Storage Abstraction**: [lib/storage/](lib/storage/) provides `StorageProvider` interface with `TelegramStorageProvider` and `S3StorageProvider` implementations.

## Tech Stack & Key Patterns

### Framework & Database
- **Next.js 16+ (App Router)**: All routes in `app/api/` use `NextResponse`. Client components must have `'use client'` directive.
- **TypeORM**: Primary ORM. Initialize via [lib/data-source.js](lib/data-source.js) using `getDataSource()`. Legacy code uses raw `pg` pool from [lib/db.js](lib/db.js) - migrate away when touching old code.
- **Migrations**: TypeORM migrations in [lib/migrations/](lib/migrations/). Run with `npm run migration:run`.

### Authentication
- **Session Cookie**: `session_user` cookie stores base64-encoded JSON with `{ id, username }`. Parse with `getUserFromSession()` from [lib/auth.js](lib/auth.js).
- **API Auth**: All API routes must call `await requireAuth(request)` to verify authentication. Returns `{ authenticated: boolean, user: { id, username } }`.
- **Master Password Unlock**: Separate from login. User logs in with account password, then "unlocks vault" with master password to derive encryption key client-side.

### File Upload/Download Flow
- **Upload**: Client encrypts chunks → POSTs to `/api/upload/chunk` with encrypted data (base64), IV, auth tag → Server stores in Telegram/S3 and saves metadata → Returns success with chunk ID.
- **Download**: Client fetches metadata via `/api/files/[id]/parts` → For each part, GETs `/api/chunk/[fileId]/[partNumber]` → Server proxies from Telegram → Client decrypts using stored key + metadata.
- **Streaming**: [lib/clientDecryption.js](lib/clientDecryption.js) and [lib/fileService.js](lib/fileService.js) implement `ReadableStream` for video/audio playback with on-the-fly decryption.

## Development Workflows

### Setup & Database
- **Initial Setup**: `npm install` → `npm run setup-db` (creates tables) → Configure `.env.local` with `DATABASE_URL`, bot tokens.
- **Migrations**: Create in [lib/migrations/](lib/migrations/), then `npm run migration:run` to apply.
- **Development Server**: `npm run dev` starts Next.js on port 3000 (default).

### Testing
- **Test Framework**: Node.js native test runner (`node:test`).
- **Run Tests**:
  - Single test: `node --test __tests__/RecoveryCodeService.test.js`
  - All tests: `node __tests__/run-all-tests.js` or `npm run test:all-recovery`
- **Test Location**: All tests in [__tests__/](__tests__/) directory.
- **Testing Guide**: See [TESTING_GUIDE.md](TESTING_GUIDE.md) for feature-specific test procedures (manual UI testing).

### Debugging
- **Telegram Issues**: Check [lib/telegram.js](lib/telegram.js) for bot interactions. Common issues: Invalid bot token, user ID mismatch.
- **Encryption Issues**: Verify IV/auth tag stored correctly in `file_parts` table. Check browser console for Web Crypto API errors.
- **Database Queries**: Set `logging: true` in [lib/data-source.js](lib/data-source.js) to log SQL queries in dev.

## Code Conventions

### API Routes
- **Structure**: `app/api/[resource]/route.js` exports `GET`, `POST`, etc. as named async functions.
- **Response**: Always use `NextResponse.json({ ... })` for JSON responses. Include proper HTTP status codes.
- **Auth Check**: Always `await requireAuth(request)` at the start of protected routes.
- **Error Handling**: Wrap in `try-catch`, return `NextResponse.json({ error: 'message' }, { status: 500 })` on failure.

### Services & Repositories
- **Services**: Export singleton instances (e.g., `export const fileService = new FileService()`). Import as `import { fileService } from '@/lib/fileService'`.
- **Repositories**: Extend `BaseRepository`, pass entity to constructor. Use async/await for all DB operations.
- **Validation**: Use `zod` schemas for request validation. Define schemas at top of service/route file.

### Client-Side Code
- **Encryption Context**: Access via `useEncryption()` hook. Check `isUnlocked` before attempting decrypt operations.
- **User Context**: Access via `useUser()` hook for current user info (`{ id, username }`).
- **Encryption Operations**: All encryption/decryption code in [lib/clientDecryption.js](lib/clientDecryption.js) and [lib/browserUploadEncryption.js](lib/browserUploadEncryption.js). Never implement crypto primitives elsewhere.

## Key Files Reference

| File | Purpose |
|------|---------|
| [lib/fileService.js](lib/fileService.js) | Core file upload/download orchestration, chunk management |
| [lib/data-source.js](lib/data-source.js) | TypeORM config, entity registration, DB connection |
| [lib/auth.js](lib/auth.js) | Session parsing, authentication middleware |
| [lib/clientDecryption.js](lib/clientDecryption.js) | Browser-side decryption, streaming, key derivation |
| [app/contexts/EncryptionContext.js](app/contexts/EncryptionContext.js) | React context for encryption key management |
| [lib/storage/TelegramStorageProvider.js](lib/storage/TelegramStorageProvider.js) | Telegram Bot API integration |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | High-level system design, data flows |
| [docs/SECURITY.md](docs/SECURITY.md) | Detailed cryptography, threat model |
| [docs/DATABASE.md](docs/DATABASE.md) | PostgreSQL schema, relationships |

## Common Pitfalls
- **Never decrypt on server**: Server code must never attempt to decrypt file content. All decryption is client-side.
- **TypeORM initialization**: Always `await getDataSource()` before using repositories. Don't assume it's initialized.
- **Session cookie encoding**: `session_user` is base64-encoded JSON. Always decode with `Buffer.from(..., 'base64').toString('utf-8')`.
- **Chunk reassembly**: Chunks must be reassembled in `part_number` order. Sort by `part_number ASC` when fetching from DB.
- **IV/AuthTag format**: Stored as hex strings in DB, must convert to `Uint8Array` for Web Crypto API.


ALWAY run build and fix before complete task.