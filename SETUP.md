# Setup Instructions

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- Telegram bot token (from BotFather)

## Step 1: Initialize Next.js Project

```bash
npm create-next-app@latest . --typescript --tailwind --eslint
# Answer prompts:
# - Use TypeScript? No (start simple)
# - Use ESLint? Yes
# - Use Tailwind? Yes
# - App Router? Yes
```

## Step 2: Install Dependencies

```bash
npm install sqlite3 telegram uuid dotenv
npm install -D tailwindcss postcss autoprefixer
```

## Step 3: Set Up Environment Variables

Create `.env.local`:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

Get bot token from Telegram BotFather.

## Step 4: Create Database Directory

```bash
mkdir -p db
```

## Step 5: Run Setup Script (creates tables)

```bash
npm run setup-db
```

## Step 6: Start Development Server

```bash
npm run dev -- -p 3999
```

App will be available at: http://localhost:3999

## Step 7: Test Upload

1. Open http://localhost:3999
2. Upload a test file
3. Check that it appears in the list
4. Try downloading

## Troubleshooting

**"Cannot find module 'sqlite3'"**
- Run: `npm install sqlite3`

**"Bot token not found"**
- Check `.env.local` has `TELEGRAM_BOT_TOKEN`
- Restart dev server after adding

**"Database locked"**
- SQLite doesn't like concurrent writes
- Normal in development; restart if issues persist
