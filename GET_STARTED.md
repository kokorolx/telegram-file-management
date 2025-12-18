# 🚀 Get Started - 3 Minutes

Your Telegram File Manager is ready. Follow these 4 simple steps.

## Step 1: Get Your Telegram Bot Token (1 min)

1. Open Telegram
2. Search for **@BotFather** (official Telegram bot creator)
3. Click and send `/newbot`
4. Follow the prompts:
   - Choose bot name (e.g., "My File Manager")
   - Choose username (e.g., "my_file_manager_bot")
5. BotFather sends you a token like: `123456789:ABCDEFGhijklmnOP...`
6. **Copy and save this token** - you'll need it next

## Step 2: Add Token to `.env.local` (30 seconds)

Open `.env.local` in this directory and replace the empty `TELEGRAM_BOT_TOKEN`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGhijklmnOP...
DATABASE_URL=./db/files.db
```

Save the file.

## Step 3: Start the App (30 seconds)

In your terminal, run:

```bash
npm run dev -- -p 3999
```

**You should see**:
```
▲ Next.js 14.0.0
- Local:        http://localhost:3999
```

## Step 4: Open in Browser (30 seconds)

Click: http://localhost:3999

You should see:
- File Manager header
- Upload form with file picker
- "No files yet" message

---

## 🎯 Test It Out

### Upload a File
1. Click the dashed file box
2. Select any file (< 100MB)
3. Optionally add description and tags
4. Click "Upload File"
5. Wait for green "✓ File uploaded successfully!"

### Your File Appears
In "My Files" section, you'll see:
- File name and size
- Upload date
- Download button
- Delete button

### Download
Click "⬇️ Download" to get your file back.

### Delete
Click "🗑️ Delete" to remove from database.

---

## ✅ Done!

Your Telegram File Manager is working.

- Files upload to Telegram (free)
- Metadata stored in SQLite (local)
- Beautiful UI for managing files
- Runs on port 3999

---

## 📚 Learn More

- **QUICKSTART.md** - Troubleshooting & detailed setup
- **ARCHITECTURE.md** - How the system works
- **API.md** - API endpoints reference
- **README.md** - Full project info

---

## 💡 Tips

### Stop the server
Press `Ctrl+C` in terminal

### Restart the server
```bash
npm run dev -- -p 3999
```

### Use different port
```bash
npm run dev -- -p 4000
```

### Reset database
```bash
rm -rf db/
npm run setup-db
npm run dev -- -p 3999
```

---

## 🆘 Stuck?

### "Module type error" after adding token
Just restart the server - no action needed.

### Port already in use
```bash
npm run dev -- -p 4000  # Use 4000 instead
```

### Upload fails with error
1. Check token is correct in `.env.local`
2. Check file is < 100MB
3. Check internet connection
4. Restart the server

### Nothing loads in browser
- Check terminal shows "Local: http://localhost:3999"
- Try refreshing browser (F5)
- Check console for errors (F12 > Console)

---

**Ready to use?** Go to http://localhost:3999

Enjoy your file manager! 🎉
