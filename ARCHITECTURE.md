# Telegram File Manager - Architecture Document

## System Overview

A Next.js-based file management system that stores files on Telegram and maintains metadata in SQLite.

```
User Browser
    ↓
Next.js App (Port 3999)
    ├── Frontend Pages (React)
    ├── API Routes
    ├── SQLite Database (metadata)
    └── Telegram Bot Integration
    ↓
Telegram Bot API (File Storage)
```

## Data Flow

### Upload Flow
1. User selects file on frontend
2. POST `/api/upload` with file
3. Backend sends file to Telegram Bot
4. Telegram returns `file_id`
5. Store metadata (filename, size, type, file_id, timestamp) in SQLite
6. Return file record to frontend

### List Flow
1. GET `/api/files`
2. Query SQLite for all file metadata
3. Return list to frontend
4. Frontend displays with file info

### Download Flow
1. User clicks download
2. GET `/api/download?file_id=xxx`
3. Backend requests file URL from Telegram API
4. Stream file to user browser

### Delete Flow
1. User clicks delete
2. DELETE `/api/files/:id`
3. Remove from SQLite
4. (Optional) Delete from Telegram
5. Return success

## Database Schema

### files table
```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  telegram_file_id TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT,
  mime_type TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT,
  tags TEXT
);
```

## API Routes

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/upload` | Upload file |
| GET | `/api/files` | List all files |
| GET | `/api/download?file_id=xxx` | Download file |
| DELETE | `/api/files/:id` | Delete file |
| GET | `/api/files/:id` | Get file details |

## Environment Variables

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=./db/files.db (for SQLite)
```

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Database**: SQLite3
- **Telegram**: node-telegram-bot-api
- **Frontend**: React with shadcn/ui (optional)
- **Styling**: Tailwind CSS (optional)

## Project Structure

```
telegram-file-manager/
├── app/
│   ├── api/
│   │   ├── upload/route.js
│   │   ├── files/
│   │   │   ├── route.js (GET, DELETE)
│   │   │   └── [id]/route.js (GET single)
│   │   └── download/route.js
│   ├── page.jsx (home - file list)
│   ├── layout.jsx
│   └── globals.css
├── lib/
│   ├── db.js (SQLite connection & queries)
│   ├── telegram.js (Telegram bot wrapper)
│   └── utils.js (helpers)
├── public/
├── .env.local (git ignored)
├── next.config.js
├── package.json
├── ARCHITECTURE.md (this file)
├── API.md (API documentation)
├── SETUP.md (setup instructions)
└── README.md
```

## Key Design Decisions

1. **SQLite over PostgreSQL**: Fast MVP, no server setup needed
2. **Next.js API Routes**: Single deployment, simpler than separate backend
3. **File IDs in DB**: Telegram file_ids are permanent, perfect for metadata
4. **No file content storage**: Save bandwidth, use Telegram as CDN

## Future Enhancements

- Search & filtering
- Folder/category organization
- User authentication
- Sharing links
- File previews
- Tags system
- Rate limiting
