# Quick Start Checklist

Complete these steps in order to get the app running.

## ✅ Step 1: Install Dependencies

```bash
npm install
```

**Expected output**: Should complete without errors. Will install ~200+ packages.

## ✅ Step 2: Get Telegram Bot Token

1. Open Telegram app
2. Search for **@BotFather**
3. Send `/newbot`
4. Follow instructions, choose a bot name
5. **Save the token** (format: `123456789:ABCdefGHIjklmNOPqrstuVWXyz...`)

## ✅ Step 3: Create `.env.local`

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit with your token
cat .env.local
```

Add your Telegram token:

```
TELEGRAM_BOT_TOKEN=your_token_here
DATABASE_URL=./db/files.db
```

## ✅ Step 4: Initialize Database

```bash
npm run setup-db
```

**Expected output**:
```
Connected to SQLite database at /path/to/db/files.db
✓ Database schema created/verified
✓ Database initialization complete
```

## ✅ Step 5: Start Development Server

```bash
npm run dev -- -p 3999
```

**Expected output**:
```
▲ Next.js 14.x.x
- Local:        http://localhost:3999
```

## ✅ Step 6: Open in Browser

Visit: http://localhost:3999

You should see:
- File Manager header
- Upload form with file picker
- "No files yet" message

## ✅ Step 7: Test Upload

1. Click upload form
2. Select any file (< 100MB)
3. Add optional description and tags
4. Click "Upload File"
5. Wait for success message
6. File should appear in "My Files" list

## ✅ Step 8: Test Download & Delete

1. Click "⬇️ Download" on your uploaded file
2. File should download
3. Click "🗑️ Delete" to remove from list
4. Confirm deletion

## Done!

Your Telegram File Manager is ready to use.

---

## Common Issues

### Module not found errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Port 3999 already in use
```bash
# Use a different port
npm run dev -- -p 4000
```

### "TELEGRAM_BOT_TOKEN is not set"
```bash
# Make sure .env.local exists and has the token
cat .env.local
# Then restart dev server
```

### Database locked error
```bash
# Just restart the server, this is normal in SQLite
npm run dev -- -p 3999
```

### File upload fails silently
- Check bot token is correct
- Check console for errors (F12 > Console)
- Verify file is < 100MB
- Try a smaller test file

---

## What's Next?

- **Add files**: Use the upload form
- **View docs**: Read ARCHITECTURE.md for system design
- **Customize**: Edit colors in app/globals.css
- **Deploy**: Build with `npm run build` and `npm run start`

---

## Support

If something doesn't work:
1. Check console errors (F12 > Console)
2. Check terminal errors
3. Restart dev server
4. Check .env.local file exists and has token
5. Run `npm install` again

Good luck! 🚀
