# Deploy to Vercel with PostgreSQL

Complete guide to deploy your Telegram File Manager to Vercel with persistent PostgreSQL database.

---

## Step 1: Prepare Your Repository

### Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/telegram-file-manager.git
git branch -M main
git push -u origin main
```

---

## Step 2: Create Vercel Postgres Database

### 2a. Create Vercel Account
1. Go to https://vercel.com
2. Sign up (or login)
3. Create a new project

### 2b. Create PostgreSQL Database

1. In Vercel dashboard, go to **Storage**
2. Click **Create New** → **Postgres**
3. Click **Create** and follow prompts
4. **Copy the connection string** (you'll need it next)

Format: `postgresql://user:password@host:5432/dbname`

---

## Step 3: Connect GitHub Repository

1. In Vercel, click **Add New** → **Project**
2. Select **Import Git Repository**
3. Choose your GitHub repository
4. Click **Import**

---

## Step 4: Add Environment Variables

In Vercel project settings:

### Add these variables:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

**Getting DATABASE_URL:**
- From Vercel Postgres creation (copy the connection string)
- Or from Vercel Storage tab

---

## Step 5: Configure Database

Vercel automatically applies the `DATABASE_URL`. Your `lib/db.js` will:
- Detect `DATABASE_TYPE=postgres`
- Connect to PostgreSQL
- Initialize tables on first run

**No manual SQL needed** - all handled by the app.

---

## Step 6: Deploy

```bash
git push origin main
```

Vercel auto-deploys on push. Your app will be at:
```
https://your-project.vercel.app
```

---

## Verification

### Check Deployment
1. Visit your Vercel URL
2. Try uploading a file
3. Verify file appears in list
4. Download to test

### Check Database
```bash
# In Vercel dashboard → Storage → Postgres
# Click "Query" to view data
SELECT * FROM files;
```

---

## Switching Between SQLite & PostgreSQL

### Local Development (SQLite)
```bash
# .env.local
DATABASE_TYPE=sqlite
DATABASE_URL=./db/files.db

npm run dev -- -p 3999
```

### Vercel Production (PostgreSQL)
```
Environment variables (set in Vercel):
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://...
```

**Automatic**: Your code detects the environment and uses correct database.

---

## Troubleshooting

### Database Connection Failed
```
Error: Could not connect to PostgreSQL
```

**Solution:**
1. Check `DATABASE_URL` in Vercel env vars
2. Verify connection string format
3. Check Vercel Postgres is created
4. Redeploy: `git push origin main`

### Files Not Persisting
```
Error: Files disappear after refresh
```

**Solution:**
1. Verify `DATABASE_TYPE=postgres` is set
2. Check `DATABASE_URL` is PostgreSQL, not SQLite path
3. Clear browser cache
4. Reload page

### Upload Fails
```
Error during file upload
```

**Check:**
1. `TELEGRAM_BOT_TOKEN` is set and correct
2. Bot token hasn't expired
3. Check Vercel logs: **Deployments** → **Logs**

### Vercel Logs
```
To view errors:
1. Vercel Dashboard
2. Select your project
3. Go to "Deployments"
4. Click latest deployment
5. View "Function Logs" or "Build Logs"
```

---

## Managing Your Database

### View Data in Vercel

1. Vercel Dashboard → **Storage** → **Postgres**
2. Click **Query**
3. Write SQL:

```sql
-- View all files
SELECT * FROM files;

-- Count files
SELECT COUNT(*) FROM files;

-- Delete a file
DELETE FROM files WHERE id = 'file-id-here';
```

### Backup Data

```bash
# Download backup from Vercel Storage tab
# Or use pg_dump:
pg_dump postgresql://user:password@host/dbname > backup.sql
```

### Restore Data

```bash
psql postgresql://user:password@host/dbname < backup.sql
```

---

## Cost & Pricing

### Vercel Postgres Free Tier
- **Storage**: 256 MB free
- **Connections**: 3 concurrent
- **Compute**: Shared

### When to Upgrade
- > 256 MB data
- Production with high traffic
- Need dedicated resources

### Estimated Costs
- **Free tier**: $0 (for small projects)
- **Paid tier**: $15/month per database
- **Vercel hosting**: $20/month

---

## Environment Variables Checklist

```
✅ TELEGRAM_BOT_TOKEN    - From @BotFather
✅ DATABASE_TYPE         - Set to "postgres"
✅ DATABASE_URL          - PostgreSQL connection string
```

---

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Vercel account created
- [ ] PostgreSQL database created in Vercel
- [ ] Repository connected to Vercel
- [ ] Environment variables added
- [ ] Deployment succeeded
- [ ] Can access your-project.vercel.app
- [ ] File upload works
- [ ] File download works
- [ ] Data persists after refresh

---

## Quick Redeploy

To redeploy with latest changes:

```bash
git add .
git commit -m "Update description"
git push origin main
```

Vercel auto-deploys. Check status in Vercel dashboard.

---

## Local Development While Using Vercel

Your local setup stays the same:

```bash
# Local dev uses SQLite
npm run dev -- -p 3999
```

Your Vercel production uses PostgreSQL automatically.

---

## Monitoring & Logs

### View Errors
```
Vercel Dashboard → Deployments → [Latest] → Function Logs
```

### Monitor Database
```
Vercel Dashboard → Storage → Postgres → Metrics
```

### Check File Uploads
```
In app: Upload a file → Check "My Files" list
```

---

## Security Notes

1. **Never expose DATABASE_URL** in code
2. **Keep TELEGRAM_BOT_TOKEN secret** (use env vars)
3. **Use Vercel's SSL** (automatic)
4. **Enable firewall** (Vercel does this)
5. **Backup regularly** (in Storage tab)

---

## Rollback to Previous Version

If something breaks:

```bash
git revert HEAD
git push origin main
```

Vercel auto-deploys the previous working version.

---

## Performance Tips

1. Use Vercel Edge Functions for faster response
2. Enable caching for images/static files
3. Monitor database connections
4. Use indexes on frequently queried fields

---

## Next Steps

1. **Deploy now** following steps above
2. **Test the app** at your Vercel URL
3. **Share your URL** with others
4. **Monitor usage** in Vercel dashboard

---

## Support

- Vercel Docs: https://vercel.com/docs
- PostgreSQL Docs: https://www.postgresql.org/docs
- Next.js Docs: https://nextjs.org/docs

---

**Status**: Ready to deploy to Vercel

**Database**: PostgreSQL (persistent, scales)

**Cost**: Free tier sufficient for most projects

Good luck! 🚀
