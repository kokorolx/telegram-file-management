# Folder Organization

Organize files into folders for better structure and navigation.

---

## Features

✅ **Create Folders** - Organize files by category  
✅ **Upload to Folders** - Choose folder when uploading  
✅ **View Folder Contents** - See only files in selected folder  
✅ **Rename Folders** - Change folder names  
✅ **Delete Folders** - Remove folders (files stay or move to root)  
✅ **Search Within Folders** - Search and filter folder contents  

---

## How It Works

### Creating a Folder

In the UI, type a folder name in the "Folders" section sidebar:

```
📁 Folders
[New folder name...] [New]
```

Click "New" to create.

**Example folders:**
- 📂 Vacation Photos
- 📂 Work Documents
- 📂 Projects
- 📂 Backups

### Organizing Files

When uploading, files can be uploaded to a specific folder or to "All Files" (root).

**UI Flow:**
1. Select folder from sidebar (or "All Files")
2. Upload file
3. File appears in selected folder

**API:**
```bash
curl -X POST http://localhost:3999/api/upload \
  -F "file=@document.pdf" \
  -F "folder_id=8c179e16-a7f6-41d3-928b-5797fb79c5be" \
  -F "description=Important document"
```

### Viewing Folder Contents

Click a folder in the sidebar to see only its files.

**API:**
```bash
# Get files in folder
curl "http://localhost:3999/api/files?folder_id=FOLDER_ID"

# Get folder info with files
curl "http://localhost:3999/api/folders/FOLDER_ID"
```

---

## API Endpoints

### Create Folder
```bash
POST /api/folders
{
  "name": "Vacation Photos"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Vacation Photos",
    "parent_id": null,
    "created_at": "2025-12-16T00:30:00Z"
  }
}
```

### List Folders
```bash
GET /api/folders
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Vacation Photos",
      "parent_id": null,
      "created_at": "2025-12-16T00:30:00Z",
      "updated_at": "2025-12-16T00:30:00Z"
    }
  ]
}
```

### Get Folder with Files
```bash
GET /api/folders/{id}
```

Response:
```json
{
  "success": true,
  "data": {
    "folder": {
      "id": "uuid",
      "name": "Vacation Photos"
    },
    "files": [
      {
        "id": "file-uuid",
        "original_filename": "beach.jpg",
        "folder_id": "folder-uuid",
        "file_size": 1024000
      }
    ]
  }
}
```

### Rename Folder
```bash
PUT /api/folders/{id}
{
  "name": "Summer Vacation 2025"
}
```

### Delete Folder
```bash
DELETE /api/folders/{id}
```

**Note:** Files in deleted folder have folder_id set to NULL (move to root).

### Upload File to Folder
```bash
POST /api/upload
FormData:
  - file: <file>
  - folder_id: uuid
  - description: optional
  - tags: optional
```

### Get Files in Folder
```bash
GET /api/files?folder_id=FOLDER_ID&page=1&limit=20
```

---

## Database Schema

### Folders Table
```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,              -- for future nested folders
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES folders(id)
);
```

### Files Table (Updated)
```sql
ALTER TABLE files ADD COLUMN folder_id TEXT;
ALTER TABLE files ADD FOREIGN KEY (folder_id) 
  REFERENCES folders(id) ON DELETE SET NULL;
```

---

## Usage Examples

### Create Folder Structure
```bash
# Create folders
curl -X POST http://localhost:3999/api/folders \
  -H "Content-Type: application/json" \
  -d '{"name": "Vacation 2025"}'

curl -X POST http://localhost:3999/api/folders \
  -H "Content-Type: application/json" \
  -d '{"name": "Work Projects"}'

curl -X POST http://localhost:3999/api/folders \
  -H "Content-Type: application/json" \
  -d '{"name": "Backups"}'
```

### Upload Files to Folders
```bash
# Get folder ID first
FOLDER=$(curl -s http://localhost:3999/api/folders | \
  jq -r '.data[0].id')

# Upload to folder
curl -X POST http://localhost:3999/api/upload \
  -F "file=@vacation.jpg" \
  -F "folder_id=$FOLDER" \
  -F "description=Beach photo" \
  -F "tags=vacation,2025"
```

### Browse Folder Contents
```bash
# Get all folders
curl http://localhost:3999/api/folders

# Get specific folder with files
curl http://localhost:3999/api/folders/FOLDER_ID

# Search within folder
curl "http://localhost:3999/api/files?folder_id=FOLDER_ID&search=beach"
```

---

## Folder Management

### Move Files Between Folders

Currently, files must be re-uploaded to change folders. Future enhancement: allow moving files.

### Nested Folders

The schema supports `parent_id` for future nested folder support:

```
Vacation/
  ├── 2024/
  ├── 2025/
  └── 2026/
```

Currently, only top-level folders are created. Nested support coming in v2.

### Folder Limits

No limits on:
- Number of folders
- Files per folder
- Folder name length (up to 100 chars)

### Folder Permissions

All folders are personal. No sharing yet.

---

## Migration Guide

If upgrading from versions without folders:

1. **Automatic Migration:**
   ```bash
   node scripts/migrate-folders.js
   ```

2. **What happens:**
   - `folders` table is created
   - `folder_id` column added to `files` table
   - Foreign key constraints added
   - All existing files stay in root (folder_id = NULL)

3. **Manual Migration:**
   If migration fails, you can manually run the schema changes.

---

## Troubleshooting

### Can't create folder
- Check folder name isn't empty
- Folder name must be under 100 characters
- Database connection is working

### Files not appearing in folder
- Verify folder_id matches when uploading
- Check /api/files?folder_id=ID API call
- Ensure file upload completed successfully

### Can't delete folder
- Folder exists and ID is correct
- Try again - temporary issue
- Files in folder will move to root on delete

### Folder not appearing in sidebar
- Refresh page to reload folder list
- Check browser console for errors
- Verify folder was created (check /api/folders)

---

## Future Enhancements

- [ ] Nested folders (folders within folders)
- [ ] Move files between folders
- [ ] Copy files to multiple folders
- [ ] Folder color coding
- [ ] Folder sharing (view/edit permissions)
- [ ] Folder compression/export
- [ ] Batch operations within folders

---

## Database Optimization

For many folders, add index:
```sql
CREATE INDEX idx_folders_name ON folders(name);
CREATE INDEX idx_files_folder_id ON files(folder_id);
```

---

**Status:** Fully functional  
**Last Updated:** December 2025
