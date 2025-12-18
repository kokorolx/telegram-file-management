# PostgreSQL Setup Guide

Complete guide for using PostgreSQL with Telegram File Manager (local and production).

---

## Local Development Setup

### Prerequisites

- PostgreSQL installed locally
- psql command-line tool (usually included)

### Step 1: Create Database

```bash
# Open PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE telegram_files;

# List databases (verify)
\l

# Exit
\q
```

### Step 2: Configure Environment

Edit `.env.local`:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_files
```

Replace `password` with your PostgreSQL password.

### Step 3: Initialize Tables

```bash
npm run setup-db
```

Expected output:
```
Connecting to PostgreSQL...
✓ Database schema created/verified
✓ Database initialization complete
```

### Step 4: Start Development

```bash
npm run dev -- -p 3999
```

Visit http://localhost:3999 and test file operations.

---

## Production Setup (Vercel)

### Step 1: Create Vercel Postgres Database

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Storage** → **Create New** → **Postgres**
4. Click **Create** and wait for setup
5. Click **Show Connection String**
6. Copy the connection string (format: `postgresql://...`)

### Step 2: Add to Vercel Environment Variables

1. Go to **Settings** → **Environment Variables**
2. Add new variable:
   - Name: `DATABASE_URL`
   - Value: Paste the connection string from step 1
3. Add Telegram token:
   - Name: `TELEGRAM_BOT_TOKEN`
   - Value: Your bot token

### Step 3: Deploy

Push to GitHub and Vercel auto-deploys:

```bash
git push origin main
```

Tables are created automatically on first request.

---

## Database Operations

### Connect to Local Database

```bash
psql -U postgres -d telegram_files
```

### View All Files

```sql
SELECT * FROM files;
```

### View File Count

```sql
SELECT COUNT(*) FROM files;
```

### View Specific File

```sql
SELECT * FROM files WHERE id = 'file-id-here';
```

### Delete Specific File

```sql
DELETE FROM files WHERE id = 'file-id-here';
```

### Backup Database

```bash
pg_dump -U postgres -d telegram_files > backup.sql
```

### Restore Database

```bash
psql -U postgres -d telegram_files < backup.sql
```

---

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify connection string in `.env.local`
3. Check database name exists: `psql -U postgres -l`

### Authentication Failed

```
Error: password authentication failed for user "postgres"
```

**Solution:**
1. Verify password in `.env.local`
2. Check PostgreSQL user exists and has correct password
3. Reset password:
   ```bash
   sudo -u postgres psql
   ALTER USER postgres PASSWORD 'newpassword';
   \q
   ```

### Database Not Found

```
Error: database "telegram_files" does not exist
```

**Solution:**
1. Create database: `psql -U postgres -c "CREATE DATABASE telegram_files;"`
2. Run `npm run setup-db` to create tables
3. Restart dev server

### Vercel Connection Issues

```
Error: SSL error while connecting
```

**Solution:**
1. Verify `DATABASE_URL` is set in Vercel environment
2. Check connection string format (should start with `postgresql://`)
3. Redeploy: `git push origin main`

### Tables Not Created

If you get "table files does not exist" error:

```bash
npm run setup-db
```

This creates the table automatically.

---

## Connection String Format

### Local

```
postgresql://username:password@localhost:5432/database_name

Example:
postgresql://postgres:mypassword@localhost:5432/telegram_files
```

### Vercel (from Postgres Storage)

```
postgresql://user:password@vercel-host:5432/verceldb

Example:
postgresql://default:password@ep-cloud-host.vercel.postgres.com:5432/verceldb
```

---

## Environment Variables

### Local (.env.local)

```
TELEGRAM_BOT_TOKEN=your_token
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_files
```

### Vercel Dashboard

```
TELEGRAM_BOT_TOKEN = your_token
DATABASE_URL = postgresql://...
```

---

## Performance Tips

### Connection Pooling

The app uses `pg.Pool` which automatically manages connection pooling.

### Indexes

To speed up queries (optional):

```sql
CREATE INDEX IF NOT EXISTS idx_telegram_file_id ON files(telegram_file_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_at ON files(uploaded_at);
```

### Monitoring

Check active connections:

```sql
SELECT * FROM pg_stat_activity;
```

---

## Switching Between Databases

### From SQLite to PostgreSQL

1. Create PostgreSQL database
2. Run `npm run setup-db`
3. Manually migrate data if needed (export/import)
4. Update `.env.local`
5. Restart dev server

### From PostgreSQL Local to Vercel

1. Create Vercel Postgres
2. Copy connection string to `.env.local` locally (for testing)
3. Set `DATABASE_URL` in Vercel environment variables
4. Deploy with `git push`

---

## Cost & Pricing

### Local PostgreSQL

**Free** - Software costs nothing, you provide hardware.

### Vercel PostgreSQL

- **Free Tier**: 256 MB storage
- **Pro**: $15/month per database
- **Growth**: $25/month per database

Sufficient for small projects on free tier.

---

## Database Maintenance

### Regular Backups

```bash
# Daily backup
pg_dump -U postgres -d telegram_files > backup-$(date +%Y%m%d).sql
```

### Monitor Disk Usage

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Vacuum (Cleanup)

```sql
VACUUM ANALYZE;
```

---

## What's Included

✓ PostgreSQL connection pooling  
✓ SSL support (for Vercel)  
✓ Automatic table creation  
✓ Error handling & logging  
✓ All queries parameterized (SQL injection safe)  
✓ Works locally and on Vercel  

---

## Next Steps

1. Set up local PostgreSQL (see Step 1-4 above)
2. Test locally: `npm run dev -- -p 3999`
3. Deploy to Vercel when ready
4. Use `POSTGRES_SETUP.md` as reference

---

**Status**: PostgreSQL configured and ready

**Deployment**: Same setup for local dev and Vercel production

Good luck! 🚀
