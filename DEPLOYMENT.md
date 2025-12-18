# Deployment Guide

How to deploy your Telegram File Manager to production.

## Option 1: Vercel (Recommended) ⭐

Vercel is the creator of Next.js and provides managed PostgreSQL.

### Setup Steps

**👉 See [POSTGRES_SETUP.md](./POSTGRES_SETUP.md) for complete PostgreSQL setup guide.**

### Quick Summary

1. **Local Setup**: Create PostgreSQL database locally
2. **Push to GitHub**: `git push origin main`
3. **Create Vercel Postgres**: Vercel Dashboard → Storage → Create Postgres
4. **Set Environment Variables**:
   ```
   DATABASE_URL = postgresql://...
   TELEGRAM_BOT_TOKEN = your_token
   ```
5. **Deploy**: Automatic on git push

### Database

- **Local Dev**: PostgreSQL (same as production)
- **Vercel Production**: PostgreSQL (managed)
- **Data**: Persists across deployments ✓

### Benefits

✓ Same database engine everywhere (no surprises)
✓ Data survives cold starts
✓ Easy to test locally before deploying
✓ Simple to manage and scale

---

## Option 2: Railway

Railway is great for Node.js apps with persistent storage.

### 1. Push to GitHub (same as above)

### 2. Connect to Railway

1. Go to https://railway.app
2. Sign up
3. Click "New Project"
4. Select "Deploy from GitHub"
5. Choose your repository

### 3. Add Variables

In project variables:
```
TELEGRAM_BOT_TOKEN=your_token
DATABASE_URL=./db/files.db
```

### 4. Deploy

Railway automatically deploys. Database persists.

---

## Option 3: Self-Hosted

### Requirements

- Node.js 18+
- Server/VPS (AWS, DigitalOcean, etc.)
- Domain (optional)

### Setup

```bash
# 1. Clone repository
git clone your-repo.git
cd telegram-file-manager

# 2. Install
npm install

# 3. Build
npm run build

# 4. Set environment
echo "TELEGRAM_BOT_TOKEN=your_token" > .env.local
echo "DATABASE_URL=./db/files.db" >> .env.local

# 5. Start production server
npm run start

# 6. Run on port 3999
npm start -- -p 3999
```

### Using PM2 (Recommended for production)

```bash
# Install PM2
npm install -g pm2

# Start app
pm2 start npm --name "file-manager" -- start -- -p 3999

# View logs
pm2 logs file-manager

# Restart on reboot
pm2 startup
pm2 save
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3999

CMD ["npm", "start", "--", "-p", "3999"]
```

Build and run:

```bash
docker build -t file-manager .
docker run -p 3999:3999 \
  -e TELEGRAM_BOT_TOKEN=your_token \
  file-manager
```

---

## Database Persistence

### SQLite (Current)
- ✅ Works locally and on Vercel
- ✅ No setup needed
- ❌ Data lost on Vercel cold starts
- ❌ Not suitable for multi-server

### PostgreSQL (Recommended for Production)

#### Use Vercel Postgres

1. In Vercel dashboard → Storage → Postgres
2. Click "Create" 
3. Vercel auto-adds connection string

#### Update Database Code

In `lib/db.js`, switch to PostgreSQL client:

```javascript
import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL);

export async function getAllFiles() {
  return await sql`SELECT * FROM files ORDER BY uploaded_at DESC`;
}

// ...update other functions similarly
```

---

## Environment Variables Checklist

For production deployment, ensure you have:

```
✅ TELEGRAM_BOT_TOKEN    - From @BotFather
✅ DATABASE_URL          - SQLite path or PostgreSQL URL
```

---

## Monitoring

### Logs

- **Vercel**: Dashboard → Logs
- **Railway**: Dashboard → Logs
- **Self-hosted**: `pm2 logs` or server logs

### Errors

Check `.env.local` for:
- Missing `TELEGRAM_BOT_TOKEN`
- Invalid database URL
- File permissions

### Performance

Monitor:
- Upload speeds
- Download speeds
- File list loading
- Database queries

---

## Updates

### Pull Latest Changes

```bash
git pull origin main
npm install
npm run build
```

### Zero-Downtime Deploy

- **Vercel**: Automatic
- **Railway**: Automatic
- **Self-hosted**: Use rolling restart with PM2

---

## Security Notes

1. **Never commit `.env.local`** - It's in `.gitignore`
2. **Use strong bot token** - Keep secret
3. **Validate file uploads** - Already done (100MB limit)
4. **Consider authentication** - Add in Phase 2
5. **Rate limiting** - Add for production if needed

---

## Troubleshooting

### Deployment fails

```
Check:
1. All dependencies installed
2. Build completes: npm run build
3. Environment variables set
4. Node.js version compatible (18+)
```

### App crashes after deploy

```
Check:
1. TELEGRAM_BOT_TOKEN is set
2. Database URL is correct
3. File permissions (for self-hosted)
4. Check logs for specific errors
```

### Files not persisting

```
Solution: Use persistent database
- Vercel Postgres (recommended)
- PostgreSQL instance
- MongoDB
```

---

## Cost Estimates

| Platform | Cost | Notes |
|----------|------|-------|
| Vercel | Free-$20/mo | Best for starting |
| Railway | Free-$5/mo | Good with Postgres |
| DigitalOcean | $5/mo | Self-hosted, simple |
| AWS | Pay-as-you-go | Most expensive |

---

**Recommended**: Start with **Vercel**, upgrade database as needed.

For questions, check platform docs or open an issue.
