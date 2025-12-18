# API Documentation

## Upload File

**POST** `/api/upload`

Upload a file to Telegram and store metadata.

### Request

- Content-Type: `multipart/form-data`
- Body:
  - `file`: File object (required)
  - `description`: Text description (optional)
  - `tags`: Comma-separated tags (optional)

### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegram_file_id": "AgAC...",
    "original_filename": "document.pdf",
    "file_size": 1024000,
    "file_type": "pdf",
    "mime_type": "application/pdf",
    "uploaded_at": "2025-12-16T10:30:00Z",
    "description": "Important document",
    "tags": "work,important"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Get All Files

**GET** `/api/files`

Retrieve all stored files metadata.

### Query Parameters

- None (filters coming in Phase 2)

### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "original_filename": "document.pdf",
      "file_size": 1024000,
      "file_type": "pdf",
      "uploaded_at": "2025-12-16T10:30:00Z"
    },
    ...
  ]
}
```

---

## Get Single File

**GET** `/api/files/:id`

Get detailed metadata for a specific file.

### Response

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "telegram_file_id": "AgAC...",
    "original_filename": "document.pdf",
    "file_size": 1024000,
    "file_type": "pdf",
    "mime_type": "application/pdf",
    "uploaded_at": "2025-12-16T10:30:00Z",
    "description": "Important document",
    "tags": "work,important"
  }
}
```

---

## Download File

**GET** `/api/download?file_id=xxx`

Get download URL and stream file to user.

### Query Parameters

- `file_id`: Telegram file_id (required)

### Response

File is streamed directly to browser with proper headers for download.

### Headers

- `Content-Disposition: attachment; filename="original_filename.ext"`
- `Content-Type: application/octet-stream`

---

## Delete File

**DELETE** `/api/files/:id`

Remove file from database.

### Response

```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

### Error Response

```json
{
  "success": false,
  "error": "File not found"
}
```

---

## Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad request (missing params, invalid file) |
| 404 | File not found |
| 500 | Server error |

---

## Rate Limits

None enforced yet (Phase 2 feature).

Telegram API: ~30 requests/second (rarely hit).
