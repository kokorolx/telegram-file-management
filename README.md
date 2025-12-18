# 🔒 Telegram File Management

A secure, Zero-Knowledge file management system that uses Telegram as a backend for unlimited, free cloud storage.

![Telegram File Manager](/docs/screenshots/dashboard.png)

## Features

- **🛡️ Zero-Knowledge Security**: All files are encrypted in your browser using AES-256-GCM before upload. Your master password never touches the server.
- **☁️ Telegram Storage**: Leverages the Telegram Bot API to store files as documents, providing a reliable and virtually unlimited storage backend.
- **📁 Folder Management**: Organize your files in a nested directory structure with friendly URLs (slugs).
- **🎥 Secure Streaming**: Watch encrypted videos and listen to audio directly in the browser through on-the-fly decryption streams.
- **🚀 Parallel Processing**: High-performance multi-part uploads and downloads with parallel cryptography.
- **👤 Multi-User Support**: Each user has their own private vault and can configure their own Telegram bots.
- **📱 Responsive Design**: Modern UI built with Tailwind CSS, optimized for both desktop and mobile.

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- A Telegram Bot (via [@BotFather](https://t.me/BotFather))
- Your Telegram User ID (via [@userinfobot](https://t.me/userinfobot))

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
4. Initialize the database:
   ```bash
   npm run setup-db
   ```
5. Start the development server:
   ```bash
   npm run dev
   ```

## Documentation

For more detailed information, please refer to the following documents:

- [**Architecture Overview**](docs/ARCHITECTURE.md): Technical design and technology stack.
- [**Security Model**](docs/SECURITY.md): Details on the Zero-Knowledge implementation and cryptography.
- [**API Reference**](docs/API.md): Documentation for the backend endpoints.
- [**Database Schema**](docs/DATABASE.md): PostgreSQL table structures and relationships.

## Deployment

This project is optimized for deployment on **Vercel** with a **Neon** or **Supabase** PostgreSQL database.

1. Push your code to GitHub.
2. Connect your repository to Vercel.
3. Configure the `DATABASE_URL` and `NEXTAUTH_SECRET` environment variables.
4. Deploy!

## License

MIT
