# Telegram File Manager

A Next.js-based file management system that stores files on Telegram and maintains metadata in SQLite.

## Features

- **Upload files** to Telegram with metadata storage
- **List all files** with sortable view
- **Download files** directly from Telegram
- **Delete files** from database
- **Add descriptions and tags** to files
- **No storage costs** - use Telegram as free CDN

## Quick Start

### 1. Clone/Setup

```bash
git clone <repo-url>
cd telegram-file-manager
npm install
```

### 2. Get Telegram Bot Token

1. Open [Telegram BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Copy your bot token

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local and add your TELEGRAM_BOT_TOKEN
```

### 4. Initialize Database

```bash
npm run setup-db
```

### 5. Start Development Server

```bash
npm run dev -- -p 3999
```

Visit http://localhost:3999

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system design.

## API Documentation

See [API.md](./API.md) for complete API reference.

## Database Schema

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

## Project Structure

```
telegram-file-manager/
├── app/
│   ├── api/                 # API routes
│   ├── components/          # React components
│   ├── page.jsx            # Home page
│   └── layout.jsx          # Root layout
├── lib/
│   ├── db.js               # Database functions
│   ├── telegram.js         # Telegram bot wrapper
│   └── utils.js            # Utility functions
├── scripts/
│   └── init-db.js          # Database initialization
├── db/                     # SQLite database (created at runtime)
└── public/                 # Static files
```

## Key Technologies

- **Framework**: Next.js 14 (App Router)
- **Database**: SQLite3
- **Telegram API**: node-telegram-bot-api
- **Frontend**: React with Tailwind CSS
- **Styling**: Tailwind CSS

## Development

### Commands

```bash
npm run dev                 # Start dev server on port 3000
npm run dev -- -p 3999     # Start on custom port
npm run build              # Production build
npm run start              # Start production server
npm run lint               # Run ESLint
npm run setup-db           # Initialize database
```

### Port 3999

As requested, the development server can be run on port 3999:

```bash
npm run dev -- -p 3999
```

## Limitations & Future Enhancements

### Current Limitations

- No user authentication (single user only)
- No file search or advanced filtering
- No folder/category organization
- No file previews
- Download URLs expire in ~1 hour (re-fetched on each request)

### Planned Features (Phase 2)

- Search & filtering by name, type, date
- Folder/category organization
- File preview thumbnails
- Advanced tagging system
- Bulk operations
- Public sharing links
- User authentication & multi-user support

## Troubleshooting

### Database Errors

**"Database locked"**
- Restart the development server
- Normal in SQLite with concurrent writes

### Telegram Errors

**"Bot token not found"**
- Check `.env.local` contains `TELEGRAM_BOT_TOKEN`
- Restart dev server after adding token

**"Failed to upload file to Telegram"**
- Verify bot token is correct
- Check bot has message permissions
- File might be too large (max 100MB)

### Dependencies

**"Cannot find module"**
- Run `npm install` again
- Delete `node_modules` and reinstall if issues persist

## License

MIT

## Support

For issues and feature requests, open an issue on the repository.
