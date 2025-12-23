# Local Storage Backend for Testing

For **localhost development and testing**, you can use the LOCAL storage backend instead of Telegram to avoid network issues and API limits.

## Setup

### 1. Set Environment Variable

Add to your `.env.local`:

```bash
STORAGE_BACKEND=LOCAL
```

### 2. Run Your Server

```bash
npm run dev
```

## How It Works

- Encrypted file chunks are stored in `.tmp/uploads/` directory
- Each user's chunks go to `.tmp/uploads/{userId}/`
- The directory is created automatically if it doesn't exist
- Chunks are served via `/api/download/local/[userId]/[filename]`

## File Structure

```
.tmp/
└── uploads/
    ├── user-1/
    │   ├── video.mov_part_1
    │   ├── video.mov_part_2
    │   └── ...
    └── user-2/
        ├── file.mp4_part_1
        └── ...
```

## Testing Video Upload & Playback

1. **Set `STORAGE_BACKEND=LOCAL`** in `.env.local`
2. Restart dev server
3. Upload a video file
4. Open the video in the lightbox
5. Video playback uses local chunks instead of Telegram

### Expected Logs

Upload:
```
[STORAGE] Using backend: LOCAL
[LocalStorage] Uploaded chunk: video.mp4_part_1 (262144 bytes) to /path/.tmp/uploads/user-123/video.mp4_part_1
[LocalStorage] Uploaded chunk: video.mp4_part_2 (262144 bytes) to /path/.tmp/uploads/user-123/video.mp4_part_2
```

Playback:
```
[VideoPlayer] Network Fetch: Chunk 1
[VideoPlayer] Successfully unwrapped DEK for file
[VideoPlayer] Attempting MediaSource API setup...
```

## Cleanup

To delete all local test uploads:

```bash
rm -rf .tmp/uploads/
```

## Switching Back to Telegram

Remove the `STORAGE_BACKEND` variable (or set to `TELEGRAM`):

```bash
unset STORAGE_BACKEND
# or in .env.local:
STORAGE_BACKEND=TELEGRAM
```

Then restart your server.
