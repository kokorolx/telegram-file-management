# Implementation Plan: Feature Development

## Database Schema Changes
Migration file: `db/migrations/002_add_stats_and_bot_tracking.sql`

### New Tables
1. **user_stats** - Aggregate user-level statistics
   - total_files, total_size, total_uploads, total_downloads
   
2. **folder_stats** - Folder-level statistics
   - files_count, total_size
   
3. **file_stats** - Per-file tracking
   - download_count, view_count, last_downloaded_at, last_viewed_at
   
4. **bot_usage_stats** - Bot usage metrics
   - files_count, total_size, uploads_count

### Schema Modifications
- Add `bot_id` to `file_parts` table (track which bot stores each part)
- Add `upload_counter` to `user_bots` table (for round-robin tracking)

---

## Implementation Order

### Phase 1: Database & Core Infrastructure
**1.1 Database Functions** (lib/db.js)
- Stats CRUD operations:
  - `createUserStats(userId)`
  - `updateUserStats(userId, delta)` 
  - `createFolderStats(folderId, userId)`
  - `updateFolderStats(folderId, delta)`
  - `createFileStats(fileId, userId)`
  - `incrementFileDownloads(fileId)`
  - `incrementFileViews(fileId)`
  - `createBotUsageStats(botId, userId)`
  - `updateBotUsageStats(botId, delta)`

- Bot rotation functions:
  - `getNextBotForUpload(userId)` - Round-robin selection
  - `incrementBotUploadCounter(botId)`
  - `resetBotUploadCounters(userId)`

### Phase 2: API Endpoints
**2.1 File Movement** (app/api/files/move)
- POST endpoint: `api/files/{fileId}/move`
- Payload: `{ targetFolderId: string | null }`
- Updates file folder_id
- Recalculates stats (folder_stats, user_stats)

**2.2 Bot Management** (app/api/bots/)
- GET `/api/bots` - List user bots
- POST `/api/bots` - Add bot
- PATCH `/api/bots/{botId}` - Update bot
- DELETE `/api/bots/{botId}` - Delete bot (with warning)
- GET `/api/bots/{botId}/stats` - Bot usage stats

**2.3 Stats Endpoints** (app/api/stats/)
- GET `/api/stats/user` - User stats
- GET `/api/stats/folder/{folderId}` - Folder stats
- GET `/api/stats/file/{fileId}` - File stats

### Phase 3: UI Components
**3.1 Dashboard** (app/components/Dashboard.jsx)
- Storage usage gauge (visual)
- Recent uploads list
- File distribution by folder (chart)
- Bot usage breakdown (table)
- Download stats for recent files

**3.2 File Management**
- Update file list UI to show file move button
- Context menu: Move file → folder selector
- Breadcrumb navigation with move option

**3.3 Bot Management UI** (app/components/BotManager.jsx)
- Bot list with CRUD buttons
- Bot stats display (files, size)
- Warning before delete
- Set default bot radio

**3.4 Fullscreen Preview** (app/components/FullscreenPreview.jsx)
- Modal/fullscreen component
- Supports: images, PDF, video
- Close button, download button
- Increment view_count on open

### Phase 4: Upload Logic Enhancement
**4.1 Bot Selection** (lib/upload.js or api/upload)
- Auto-select bot using round-robin (getNextBotForUpload)
- Track bot_id in file_parts table
- If user has no bots, use system default

**4.2 Stats Updates**
- On successful upload:
  - Increment user_stats.total_files, total_uploads, total_size
  - Increment folder_stats.files_count, total_size
  - Create file_stats record
  - Update bot_usage_stats
  - Increment bot.upload_counter

### Phase 5: Download/View Tracking
**5.1 Download Handler** (app/api/files/download)
- Increment file_stats.download_count
- Update file_stats.last_downloaded_at
- Decrement user_stats.total_size (optional: show available vs used)

**5.2 Preview/View Tracking**
- Call increment endpoint when preview opens
- Increment file_stats.view_count

---

## File Structure Overview

```
app/
├── api/
│   ├── files/
│   │   ├── move.js (NEW)
│   │   └── [download/view endpoints]
│   ├── bots/ (NEW)
│   │   ├── index.js (GET list, POST create)
│   │   ├── [botId]/
│   │   │   ├── index.js (PATCH update, DELETE)
│   │   │   └── stats.js (GET bot stats)
│   └── stats/ (NEW)
│       ├── user.js (GET user stats)
│       ├── folder/
│       │   └── [folderId].js
│       └── file/
│           └── [fileId].js
├── components/
│   ├── Dashboard.jsx (NEW)
│   ├── BotManager.jsx (NEW)
│   ├── FullscreenPreview.jsx (NEW)
│   └── FileList.jsx (UPDATE: add move button)
└── [existing structure]

lib/
├── db.js (ADD: stats and bot functions)
└── [existing helpers]
```

---

## Key Implementation Details

### Round-Robin Bot Selection
```javascript
// Pseudo-code
async function getNextBotForUpload(userId) {
  const bots = await getUserBots(userId);
  if (bots.length === 0) return SYSTEM_DEFAULT_BOT;
  
  // Find bot with lowest upload_counter
  const selected = bots.reduce((min, b) => 
    b.upload_counter < min.upload_counter ? b : min
  );
  
  await incrementBotUploadCounter(selected.id);
  return selected;
}
```

### File Movement
- Only updates `folder_id` in files table
- Recalculates source and target folder stats
- No file part changes needed (encrypted parts stay on Telegram)

### Stats Calculation
- **user_stats**: Sum of all files for that user
- **folder_stats**: Sum of files in that specific folder only
- **file_stats**: Per-file metrics (downloads, views)
- **bot_usage_stats**: Aggregate by bot_id across file_parts

---

## Notes

1. **Backward Compatibility**: Stats are optional; system works without them
2. **Performance**: Use indexes on foreign keys and frequently queried columns
3. **Data Integrity**: ON DELETE CASCADE ensures orphaned records don't accumulate
4. **Dashboard**: Consider caching stats to reduce query load
5. **Bot Deletion Warning**: Show affected files count before confirming delete

