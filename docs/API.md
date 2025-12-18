# API Reference

This document documents the internal API endpoints used by the Telegram File Management system.

## Authentication

### `POST /api/auth/login`
Authenticates a user and sets a session cookie.
- **Body**: `{ username, password }`
- **Response**: `200 OK` with user object.

### `POST /api/auth/register`
Creates a new user account.
- **Body**: `{ username, password }`
- **Response**: `200 OK` with user object.

### `GET /api/auth/me`
Returns the currently authenticated user's profile.
- **Response**: `200 OK` with user info or `401 Unauthorized`.

### `POST /api/auth/verify-master`
Verifies the master password and returns the encryption salt.
- **Body**: `{ password }`
- **Response**: `{ success: true, salt: "..." }`

## Files

### `GET /api/files`
List files for the authenticated user.
- **Query Params**:
  - `path`: (Optional) Filter by folder path (e.g., `/photos/vacation`).
  - `search`: (Optional) Search term for filename.
  - `page`: (Optional) Pagination page number.
- **Response**: `{ data: [...], pagination: {...} }`

### `GET /api/files/[id]/parts`
Returns metadata for all encrypted chunks of a file.
- **Response**: `{ parts: [{ part_number, iv, auth_tag, size }, ...] }`

### `DELETE /api/files/[id]`
Deletes a file from the database. Note: The file remains on Telegram but is no longer accessible via the UI.

## Folders

### `GET /api/folders`
Lists subfolders for a given parent.
- **Query Params**:
  - `parent_id`: (Optional) ID of the parent folder.
- **Response**: `{ data: [...] }`

### `POST /api/folders`
Creates a new folder.
- **Body**: `{ name, parent_id }`
- **Response**: `201 Created` with folder object.

## Upload & Chunks

### `POST /api/upload/chunk`
Uploads an encrypted chunk.
- **Body**:
  ```json
  {
    "file_id": "uuid",
    "part_number": 1,
    "total_parts": 10,
    "encrypted_data": "base64...",
    "iv": "hex...",
    "auth_tag": "hex...",
    "original_filename": "file.zip",
    "mime_type": "...",
    "folder_id": "uuid"
  }
  ```
- **Process**:
  1. Creates `files` record if `part_number == 1`.
  2. Uploads `encrypted_data` as a Document to Telegram.
  3. Saves `file_parts` record with the resulting Telegram `file_id`.

### `GET /api/chunk/[fileId]/[partNumber]`
Fetches the raw encrypted binary from Telegram.
- **Response**: `Content-Type: application/octet-stream`.

## Settings

### `GET /api/settings`
Returns user-specific settings (encryption salt, etc.).

### `POST /api/settings/bots`
Adds a new Telegram bot configuration for the user.
- **Body**: `{ name, botToken, tgUserId }`
- **Process**: Encrypts sensitive bot tokens before storing in the database.
