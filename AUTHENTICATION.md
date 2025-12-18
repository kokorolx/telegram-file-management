# Authentication & Setup

Simple authentication system for managing Telegram bot credentials.

---

## Quick Setup (UI-Based)

### First Time Setup

1. **Start the app**: `npm run dev -- -p 3999`
2. **Open browser**: http://localhost:3999
3. **Setup Modal appears** with three fields:
   - **Telegram Bot Token** - from @BotFather
   - **Your Telegram User ID** - from @userinfobot
   - **Setup Token** - default is `default-setup-token` (see `.env.local`)

### Getting Your Credentials

#### Bot Token
1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot`
3. Choose a name and copy the token

#### User ID
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Send `/start`
3. Copy your numeric ID

#### Setup Token
- Find in `.env.local`: `SETUP_TOKEN=default-setup-token`
- For production, change this to a secure random string

---

## How It Works

### Database Storage

Credentials are stored in PostgreSQL `settings` table:

```sql
CREATE TABLE settings (
  id INT PRIMARY KEY,
  telegram_bot_token TEXT NOT NULL,
  telegram_user_id TEXT NOT NULL,
  setup_complete BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Fallback to Environment Variables

If database credentials aren't found, the app falls back to `.env.local`:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_USER_ID`

This allows you to skip the UI setup if you prefer environment variables.

### API Endpoints

#### Check Setup Status
```bash
curl http://localhost:3999/api/settings
```

Response:
```json
{
  "success": true,
  "setupComplete": true
}
```

#### Save Settings
```bash
curl -X POST http://localhost:3999/api/settings \
  -H "Content-Type: application/json" \
  -d '{
    "botToken": "123456:ABC-DEF...",
    "userId": "708860670",
    "setupToken": "default-setup-token"
  }'
```

---

## Security Notes

⚠️ **For Production:**

1. **Change SETUP_TOKEN** to a secure random string:
   ```bash
   SETUP_TOKEN=$(openssl rand -hex 32)
   echo "SETUP_TOKEN=$SETUP_TOKEN" >> .env.local
   ```

2. **Use environment variables** in production instead of storing in database

3. **Restrict database access** - credentials are stored unencrypted in PostgreSQL

4. **Set up HTTPS** - credentials travel over the network during setup

---

## Troubleshooting

### Setup Modal Keeps Appearing

**Problem:** After entering credentials, the modal still appears.

**Solution:**
1. Check setup token matches `SETUP_TOKEN` in `.env.local`
2. Verify database connection is working
3. Run `npm run setup-db` to ensure `settings` table exists

### "Invalid setup token" Error

**Problem:** Correct credentials but wrong token.

**Solution:**
- Find your `SETUP_TOKEN` in `.env.local`
- Default is `default-setup-token`
- Copy exactly (case-sensitive)

### Settings Not Persisting

**Problem:** Settings get cleared after restart.

**Solution:**
1. Check PostgreSQL is running: `pg_isready`
2. Verify database connection: `psql -U postgres -d telegram_files`
3. Check settings table exists: `SELECT * FROM settings;`
4. Run `npm run setup-db` if needed

---

## Manual Setup (Skip UI)

If you prefer to set environment variables instead:

1. Edit `.env.local`:
   ```env
   TELEGRAM_BOT_TOKEN=your_token_here
   TELEGRAM_USER_ID=your_user_id_here
   SETUP_TOKEN=your_setup_token_here
   ```

2. The UI setup modal will still appear but you can close it (if DB setup is incomplete)

3. App will use environment variables as fallback

---

## Changing Credentials

### Via UI
1. Delete the settings record from database:
   ```bash
   psql -U postgres -d telegram_files
   DELETE FROM settings WHERE id = 1;
   ```
2. Restart app
3. Setup modal will appear again

### Via Database
```bash
psql -U postgres -d telegram_files

UPDATE settings 
SET telegram_bot_token = 'new_token',
    telegram_user_id = 'new_id',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
```

### Via Environment
Update `.env.local` and restart app:
```env
TELEGRAM_BOT_TOKEN=new_token_here
TELEGRAM_USER_ID=new_user_id_here
```

---

## Environment Variables

| Variable | Required | Source | Use |
|----------|----------|--------|-----|
| `TELEGRAM_BOT_TOKEN` | No | @BotFather | Bot API token |
| `TELEGRAM_USER_ID` | No | @userinfobot | Where to store files |
| `SETUP_TOKEN` | Yes | Generate | Secure setup verification |
| `DATABASE_URL` | Yes | PostgreSQL | Database connection |

---

## Production Deployment

### Vercel

1. Set environment variables in Vercel dashboard:
   ```
   SETUP_TOKEN = secure-random-string
   DATABASE_URL = postgresql://...
   ```

2. Don't set `TELEGRAM_BOT_TOKEN` or `TELEGRAM_USER_ID` - use UI setup instead

3. First request to `/api/settings` will show `setupComplete: false`

4. Visit the app and complete setup via the modal

---

## FAQ

**Q: Can I reset credentials?**  
A: Yes, delete the settings record or restart with different env vars.

**Q: Is this secure?**  
A: Credentials stored in database are unencrypted. For production, use environment variables only.

**Q: What if I forget the setup token?**  
A: Check `.env.local` or use environment variables instead.

**Q: Can multiple users set different credentials?**  
A: No, there's only one settings record. Use one setup token across your team.

---

**Status:** Ready for use  
**Last Updated:** December 2025
