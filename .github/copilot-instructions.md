# Telegram File Management - AI Agent Instructions

## Architecture Overview

This is a **Zero-Knowledge encrypted file storage system** using Telegram as a backend. The core principle: **all encryption happens client-side** in the browser using Web Crypto API. The server never sees plaintext or encryption keys.

### Key Components

- **Frontend**: Next.js 14 App Router with React 19 (`'use client'` for all interactive components)
- **Backend**: Next.js API routes (Node.js) acting as proxy between browser and Telegram
- **Database**: PostgreSQL via TypeORM (metadata only - NO file content)
- **Storage**: Telegram Bot API stores encrypted file chunks as documents
- **Encryption**: Browser-side AES-256-GCM with PBKDF2 key derivation (100k iterations)

### Data Flow Pattern

1. **Upload**: Browser → encrypts file chunks → API route → Telegram Bot API → stores encrypted `telegram_file_id` in PostgreSQL
2. **Download**: Browser requests metadata → fetches encrypted chunks from Telegram via API proxy → decrypts in browser

## Critical Patterns

### 1. Encryption Layer (`lib/envelopeCipher.js`, `lib/browserUploadEncryption.js`)

- **Envelope encryption**: Each file gets a unique DEK (Data Encryption Key), wrapped by KEK (Key Encryption Key) derived from master password
- Files are split into **randomized chunks** (2MB-3MB) to prevent traffic analysis
- Each chunk has unique IV and auth tag stored in `file_parts` table
- Master password NEVER leaves browser - stored in `EncryptionContext` RAM only

```javascript
// When working with encryption:
// - Always use generateDEK() for new files
// - Store encrypted_file_key, key_iv, and encryption_version in DB
// - Each chunk needs: iv, auth_tag, telegram_file_id
```

### 2. Repository Pattern

All database access goes through repositories extending `BaseRepository`:

```javascript
// lib/repositories/*Repository.js pattern:
import { BaseRepository } from "./BaseRepository.js";
import { EntityName } from "../entities/EntityName.js";

export class EntityRepository extends BaseRepository {
  constructor() {
    super(EntityName);
  }
  // Custom query methods here
}

export const entityRepository = new EntityRepository(); // Singleton
```

**Always use existing repositories** - don't access TypeORM directly in API routes.

### 3. Service Layer Pattern

Business logic lives in services (`lib/services/*Service.js`, `lib/fileService.js`):

- `fileService.handleUploadChunk()` - processes chunk uploads + stats
- `statsService` - tracks storage/bandwidth per user/folder/bot
- `FolderService` - handles nested folder operations

API routes should be thin - delegate to services for complex operations.

### 4. Next.js API Routes Structure

```javascript
// app/api/[resource]/route.js pattern:
import { requireAuth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Disable caching

export async function POST(request) {
  const auth = await requireAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = auth.user?.id;
  // ... delegate to service layer
}
```

### 5. TypeORM Entity Schema Pattern

Entities use `EntitySchema` (not decorators) in `lib/entities/*.js`:

```javascript
import { EntitySchema } from "typeorm";

export const File = new EntitySchema({
  name: "File",
  tableName: "files",
  columns: { /* ... */ },
  relations: { /* ... */ }
});
```

Database initialization: `await getDataSource()` from `lib/data-source.js` (singleton pattern).

### 6. Client-Side State Management

- **UserContext** (`app/contexts/UserContext.js`): Authentication state
- **EncryptionContext** (`app/contexts/EncryptionContext.js`): Master password + derived key in RAM
  - `unlock(password, salt)` - derives key and stores in memory
  - `lock()` - clears key and cache
  - Auto-locks on logout/reload

### 7. Multi-User & Multi-Bot Support

- Each user can configure their own Telegram bot via `user_bots` table (encrypted tokens)
- Fallback hierarchy: User bot → Global DB settings → `process.env.TELEGRAM_BOT_TOKEN`
- See `lib/telegram.js` `getBotToken(userId)` for resolution logic

## Development Workflow

```bash
# Setup
npm install
npm run setup-db              # Initialize PostgreSQL schema

# Development
npm run dev                   # Next.js dev server on :3000

# Database migrations
node scripts/migrate-*.js     # Manual migration scripts in scripts/
```

### Environment Variables

Required in `.env.local`:
- `DATABASE_URL` - PostgreSQL connection string
- `TELEGRAM_BOT_TOKEN` - Fallback bot token (can be configured per-user via UI)
- `NEXTAUTH_SECRET` - Session encryption key

## Common Tasks

### Adding a New API Endpoint

1. Create `app/api/[resource]/route.js` with `requireAuth()` check
2. Add service method in `lib/services/` if complex logic needed
3. Use existing repository pattern - don't create raw SQL

### Adding a New Database Entity

1. Create `lib/entities/NewEntity.js` using `EntitySchema` pattern
2. Add to `lib/data-source.js` entities array
3. Create repository in `lib/repositories/NewEntityRepository.js`
4. Write SQL migration in `db/migrations/` if needed (manual execution)

### Working with Encrypted Files

- **Never** decrypt on server - always return encrypted chunks
- Browser handles decryption via `lib/clientDecryption.js`
- Streaming playback uses `ReadableStream` for memory efficiency (see `FileViewer.jsx`)

### Context Menu & Multi-Select

- Uses custom hooks: `useMultiSelect()`, `useMoveContextMenu()`
- Multi-select state managed via `Set<id>` for files and folders separately
- Context menus support both single-item and batch operations

## Security Considerations

- **Master password loss = permanent data loss** - no recovery mechanism by design
- Session cookies are httpOnly, 1-week expiry
- File chunks authenticated with GCM tags - verify on decrypt
- User isolation: always filter by `user_id` in queries (see `requireAuth()` for userId extraction)

## Testing & Debugging

- Check Network tab for API errors (encrypted payloads are base64)
- Console logs show encryption stages: "Fetching chunks...", "Decrypting part X/Y..."
- Use `scripts/diag.js` for database diagnostics
- Telegram API errors logged server-side with `[TELEGRAM]` prefix

## Deployment (Vercel)

- Optimized for Vercel + Neon/Supabase PostgreSQL
- Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `TELEGRAM_BOT_TOKEN` in Vercel env vars
- SSL config auto-detected in `lib/data-source.js` based on connection string
