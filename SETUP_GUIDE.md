# Telegram File Manager - Setup Guide

Complete setup instructions for getting the app running locally and in production.

---

## Quick Start (5 minutes)

### 1. Get Telegram Bot Token

1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot`
3. Choose a name for your bot
4. Copy the bot token (format: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

### 2. Get Your Telegram User ID

1. Open Telegram and message [@userinfobot](https://t.me/userinfobot)
2. Send `/start`
3. You'll see your numeric user ID (format: `123456789`)

### 3. Setup PostgreSQL (Local)

```bash
# Check if PostgreSQL is installed
psql --version

# If not installed, install via Homebrew:
brew install postgresql@16
brew services start postgresql@16
```

### 4. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE telegram_files;

# Exit
\q
```

### 5. Configure Environment

Create/edit `.env.local`:

```env
TELEGRAM_BOT_TOKEN=your_token_here
TELEGRAM_USER_ID=your_user_id_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_files
```

Replace:
- `your_token_here` with your bot token from step 1
- `your_user_id_here` with your user ID from step 2
- `password` with your PostgreSQL password (default: usually `postgres`)

### 6. Initialize Database

```bash
npm run setup-db
```

Expected output:
```
✓ PostgreSQL database initialized
```

### 7. Start Development Server

```bash
npm run dev -- -p 3999
```

Visit http://localhost:3999 in your browser.

---

## Features

✅ **Upload Files** - Upload up to 100MB  
✅ **Store on Telegram** - Free unlimited storage  
✅ **Search & Filter** - Sort by date, name, size  
✅ **Add Metadata** - Description and tags  
✅ **Download Files** - Retrieve anytime  
✅ **Delete Files** - Remove from database  

---

## API Endpoints

### Upload File
```bash
curl -X POST http://localhost:3999/api/upload \
  -F "file=@your-file.txt" \
  -F "description=My file" \
  -F "tags=important,backup"
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "telegram_file_id": "...",
    "original_filename": "your-file.txt",
    "file_size": 1024,
    "description": "My file",
    "tags": "important,backup"
  }
}
```

### List Files
```bash
curl http://localhost:3999/api/files
```

### Get File Details
```bash
curl http://localhost:3999/api/files/{id}
```

### Download File
```bash
curl http://localhost:3999/api/download?file_id={id} -o myfile.txt
```

### Delete File
```bash
curl -X DELETE http://localhost:3999/api/files/{id}
```

---

## Troubleshooting

### PostgreSQL Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
1. Check PostgreSQL is running: `pg_isready`
2. If not, start it: `brew services start postgresql@16`
3. Verify password in `.env.local`

### Telegram "chat not found" Error
```
Error: Bad Request: chat not found
```

**Solution:**
1. Verify `TELEGRAM_USER_ID` is correct in `.env.local`
2. Double-check with [@userinfobot](https://t.me/userinfobot)
3. Bot must send message to you first - message your bot: `/start`

### Database Table Not Found
```
Error: relation "files" does not exist
```

**Solution:**
```bash
npm run setup-db
```

### Build or Dev Server Won't Start
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
npm install

# Try again
npm run dev -- -p 3999
```

---

## Production Deployment (Vercel)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Create Vercel Postgres

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **Storage** → **Create New** → **Postgres**
4. Click **Create** and wait for setup
5. Click **Show Connection String**

### 3. Set Environment Variables

In Vercel Dashboard, go to **Settings** → **Environment Variables**:

```
TELEGRAM_BOT_TOKEN = your_bot_token
TELEGRAM_USER_ID = your_user_id
DATABASE_URL = postgresql://...  (from step 2)
```

### 4. Deploy

Push to GitHub and Vercel auto-deploys:

```bash
git push origin main
```

Tables are created automatically on first request.

---

## Database Management

### Backup Database
```bash
pg_dump -U postgres -d telegram_files > backup.sql
```

### Restore Database
```bash
psql -U postgres -d telegram_files < backup.sql
```

### View All Files
```bash
psql -U postgres -d telegram_files -c "SELECT id, original_filename, file_size FROM files ORDER BY uploaded_at DESC;"
```

### Delete Specific File
```bash
psql -U postgres -d telegram_files -c "DELETE FROM files WHERE id = 'file-uuid';"
```

---

## Project Structure

```
telegram-file-manager/
├── app/
│   ├── api/
│   │   ├── upload/route.js      # File upload endpoint
│   │   ├── download/route.js    # File download endpoint
│   │   ├── files/route.js       # List files endpoint
│   │   └── files/[id]/route.js  # File details/delete endpoint
│   ├── components/
│   │   ├── UploadForm.jsx       # Upload UI
│   │   ├── FileList.jsx         # Files list UI
│   │   └── FileCard.jsx         # Individual file UI
│   └── page.jsx                 # Home page
├── lib/
│   ├── db.js                    # PostgreSQL database layer
│   ├── telegram.js              # Telegram API integration
│   └── utils.js                 # Utilities
├── scripts/
│   └── init-db.js               # Database initialization
├── .env.local                   # Environment variables (local)
├── .env.local.example           # Example environment variables
└── package.json
```

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | `123:ABC-DEF...` |
| `TELEGRAM_USER_ID` | Your Telegram user ID | `708860670` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/telegram_files` |

---

## Common Commands

```bash
# Start development server
npm run dev -- -p 3999

# Build for production
npm run build

# Start production server
npm start

# Initialize database
npm run setup-db

# Lint code
npm lint
```

---

## Support

For issues:
1. Check **Troubleshooting** section above
2. Verify all environment variables are set
3. Check PostgreSQL is running
4. Review logs in terminal
5. Ensure bot token and user ID are correct

---

**Status:** Ready to use  
**Last Updated:** December 2025
