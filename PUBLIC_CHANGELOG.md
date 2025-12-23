# What's New

All user-facing updates and improvements to Telegram Vault.

## [December 23, 2025] - Performance & UI Polish

### ⚡ Performance
- **Smart CDN Caching** - Encrypted file chunks are now cached by the global edge network, making repeat downloads significantly faster
- **Optimized Connections** - Database and Queue connections are now more robust in production environments

### 💅 UI Improvements
- **Preview Progress** - Real-time progress percentage and ETA display when decrypting files
- **Clearer Actions** - "Preview" and "Download" are now distinct actions on secure shared links
- **Visual Polish** - Improved contrast and styling for the Unlock Vault modal

### 🐛 Bug Fixes
- **Progress Tracking** - Fixed an issue where the download progress bar would stay at 0% for large files
- **Redis Stability** - Resolved connection stability issues in production environments

## [December 22, 2025] - Recovery Code System (Coming Soon)

### 🔐 Enhanced Security
- **Master Password Recovery Codes** - Secure way to reset your master password if you forget it
- **One-Time Use Codes** - Generate a set of 10 unique recovery codes (each code works once)
- **Never Expires?** - Codes are valid for 1 year from generation
- **Zero-Knowledge Design** - We cannot reset your password for you; only you can with your codes

### 💾 How to Use
1. Go to Settings → Recovery & Security
2. Click "Generate Recovery Codes"
3. Verify your login password
4. Save the 10 codes in a secure location (printed, written down, or password manager)
5. If you forget your master password, use any code to reset it

### 🎯 What This Means
Your master password is truly irreplaceable—but we've given you a backup plan. These codes let you recover your vault if you forget your password, without us being able to access your data.

---

## [December 22, 2025] - Personal S3 Backup Configuration

### ✨ New Features
- **Your Own S3 Bucket** - Store backups in your personal AWS S3 or Cloudflare R2 account for complete control
- **Secure Credential Storage** - Your S3 access keys are encrypted with your Master Password and never stored in plain text
- **Automatic Priority** - Personal S3 backup takes priority over global backup; falls back gracefully if unavailable
- **Zero Trust Encryption** - Credentials are re-encrypted by the browser before sending to server, and only decrypted in server memory during active use

### 🔒 Security Highlights
- **Never Shared with Server** - Your Master Password is never sent to the server; credential encryption/decryption happens entirely in your browser
- **Ephemeral Decryption** - S3 credentials are decrypted by the server only when needed and immediately discarded after use
- **Military-Grade Encryption** - Credentials use RSA-4096 encryption in transit + Master Password encryption at rest
- **Your Cloud, Your Control** - Backups go directly to your personal cloud account; we never see your credentials

### 🎯 What This Means
You now have complete control over where your backups are stored. Your S3 credentials stay encrypted and private at all times, with zero trust in the server.

---

## [December 21, 2025] - Cloud Backup Storage

### ✨ New Features
- **S3/R2 Backup** - Your files can now be mirrored to S3-compatible storage (AWS S3, Cloudflare R2) for extra reliability
- **Backup Settings Modal** - Configure your own backup storage directly from the app with provider selection and storage class options
- **Automatic Fallback** - If Telegram is slow or unavailable, files are automatically served from your backup storage
- **Storage Classes** - Choose between Standard, Infrequent Access, or other tiers to optimize costs

### 🔒 Security Highlights
- **Private by Default** - All backup files are stored privately with secure, time-limited access links
- **Encrypted Configuration** - Your backup credentials are encrypted with your Master Password

### 🎯 What This Means
Your files are now more resilient than ever. Even if Telegram has issues, your data remains accessible from your personal cloud backup.

---

## [December 21, 2025] - Resume Interrupted Uploads

### ✨ New Features
- **Resume Uploads** - If your upload is interrupted, you can now resume it from where it left off without re-uploading everything
- **Smart Chunk Management** - Uploads are broken into optimized chunks for better reliability

### 🎯 What This Means
No more losing progress on large file uploads. Your uploads are now more resilient to network interruptions.

---

## [December 19, 2025] - Instant Secure Sharing

### ✨ New Features
- **Share Files Instantly** - Create shareable links for your encrypted files in seconds (no re-encryption needed)
- **Password Protected Sharing** - Optionally protect shared links with passwords
- **Auto-Expiring Links** - Set links to expire after 1, 7, or 30 days
- **Guest Access** - Recipients can preview and download shared files without creating an account

### 🔒 Security Improvements
- **Stronger Encryption** - Better encryption architecture for shared files
- **Safer Logout** - All your decrypted files are now completely cleared from memory when you log out
- **Better File Limits** - System now supports files larger than 2GB

### 🆙 Migrations
- **One-Click Security Upgrade** - Easily upgrade your existing files to the new, more secure encryption format

### 🎯 What This Means
Sharing encrypted files with others is now instant and secure. Your privacy is enhanced with automatic logout protection.

---

## [December 18, 2025] - Browser-Side Decryption

### ✨ New Features
- **Local Decryption** - Your files are now decrypted in your browser, not on our servers
- **Better Previews** - Faster image and video previews with streaming support
- **Parallel Downloads** - Download multiple files faster with parallel processing

### 🔒 Security Improvements
- **Zero-Knowledge Architecture** - We truly cannot see your data anymore. Only you have the encryption key
- **Local Key Storage** - Your encryption keys never leave your device

### ⚡ Performance
- **Faster Playback** - Video streaming is significantly faster
- **Smart Caching** - Your device caches decrypted files for quicker access

### 🎯 What This Means
Your files are more secure, faster to access, and we have zero knowledge of your data.

---

## [Previous Updates] - Core Features

### ✨ Included Features
- **Zero-Knowledge Encryption** - All files encrypted before leaving your device
- **Telegram Storage** - Unlimited storage powered by Telegram's infrastructure
- **Secure Folders** - Organize files into encrypted folders
- **Search & Tags** - Find your files quickly with search and custom tags
- **Multi-File Upload** - Upload multiple files at once
- **File Management** - Delete, move, and organize your files
- **Session-Based Access** - Secure login with session-based authentication

### 🎯 What This Means
A completely private, encrypted vault for your files with the reliability of Telegram's infrastructure.

---

## Upcoming Features

### 🚀 In Development
- [ ] **Video Processing** - Transcoding, thumbnail generation, and adaptive streaming for video files
- [ ] **Session Management & Load Balancing** - Redis-backed session persistence with multi-node deployment support

### 📋 Future Roadmap
- [ ] **Backup Service** - Automated backup integration (WordPress, databases, etc.) with encrypted storage and restore capabilities
- [ ] **Advanced File Previews** - Support for CSV, JSON, source code, documents, and more with syntax highlighting
- [ ] **Enterprise Support** - Role-Based Access Control (RBAC), audit logs, compliance features, and dedicated support
- [ ] Advanced file versioning and restore
- [ ] Collaborative sharing with access control
- [ ] Bulk operations (multi-select, batch delete)
- [ ] Mobile app support
- [ ] White-label options for enterprises
- [ ] Webhook integrations and API access
