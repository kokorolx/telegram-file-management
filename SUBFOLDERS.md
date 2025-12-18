# Subfolder Management Guide

Organize files in hierarchical folder structures with unlimited nesting.

---

## Overview

The file manager supports nested folders (subfolders within subfolders):

```
📁 My Storage
├── 📁 Videos
│   ├── 📁 Tutorials
│   │   ├── video1.mp4
│   │   └── video2.mp4
│   └── 📁 Personal
│       └── video3.mp4
├── 📁 Photos
│   ├── 📁 2024
│   │   ├── photo1.jpg
│   │   └── photo2.jpg
│   └── 📁 2023
└── 📁 Documents
    ├── contract.pdf
    └── notes.txt
```

---

## Creating Folders

### Create Root Folder

Root folders have no parent:

```bash
curl -X POST http://localhost:3000/api/folders \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Videos"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    "name": "Videos",
    "parent_id": null,
    "created_at": "2024-12-16T10:00:00Z"
  }
}
```

### Create Subfolder

Subfolders have a parent_id:

```bash
curl -X POST http://localhost:3000/api/folders \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Tutorials",
    "parent_id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d"
  }'

# Response:
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e",
    "name": "Tutorials",
    "parent_id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    "created_at": "2024-12-16T10:01:00Z"
  }
}
```

**Nesting Depth:** Unlimited (create subfolders of subfolders)

---

## Listing Folders

### List Root Folders

Get all top-level folders:

```bash
curl 'http://localhost:3000/api/folders'

# Response:
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
      "name": "Videos",
      "parent_id": null
    },
    {
      "id": "x7y8z9a0-b1c2-3d4e-5f6a-7b8c9d0e1f2a",
      "name": "Photos",
      "parent_id": null
    }
  ]
}
```

### List Subfolders

Get all subfolders inside a parent:

```bash
curl 'http://localhost:3000/api/folders?parent_id=a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d'

# Response:
{
  "success": true,
  "data": [
    {
      "id": "b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e",
      "name": "Tutorials",
      "parent_id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d"
    },
    {
      "id": "c3d4e5f6-a7b8-4c7d-9e8f-7f6a5b4c3d2e",
      "name": "Personal",
      "parent_id": "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d"
    }
  ]
}
```

---

## Uploading Files to Folders

### Upload to Root

If folder_id is null, file goes to root:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@photo.jpg" \
  -F "description=My photo" \
  -F "tags=personal" \
  # No folder_id = root level
```

### Upload to Subfolder

Specify folder_id to place file in folder:

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "file=@tutorial.mp4" \
  -F "description=How to code" \
  -F "tags=tutorial,python" \
  -F "folder_id=b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e"

# Response:
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "folder_id": "b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e",
    "original_filename": "tutorial.mp4",
    ...
  }
}
```

---

## Getting Files in Folder

### Get Files in Specific Folder

```bash
curl 'http://localhost:3000/api/files?folder_id=b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e'

# Response:
{
  "success": true,
  "data": [
    {
      "id": "file-uuid",
      "folder_id": "b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e",
      "original_filename": "tutorial.mp4",
      "mime_type": "video/mp4",
      "file_size": 52428800,
      ...
    }
  ]
}
```

### Get All Files (Ignoring Folders)

To get all files across all folders:

```bash
curl 'http://localhost:3000/api/files'

# Returns all files in any folder
```

---

## Folder Navigation

### Breadcrumb Navigation

To show path like: Videos > Tutorials > ...

1. **Get current folder info:**
   ```bash
   curl 'http://localhost:3000/api/folders/b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e'
   ```

2. **Get parent folder (if exists):**
   ```bash
   # If parent_id is not null, get that folder
   curl 'http://localhost:3000/api/folders/a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d'
   ```

3. **Repeat until parent_id is null** (root reached)

### Building Full Path

JavaScript example:

```javascript
async function getFolderPath(folderId) {
  const path = [];
  let currentId = folderId;
  
  while (currentId) {
    const response = await fetch(`/api/folders/${currentId}`);
    const folder = await response.json();
    
    path.unshift(folder.name); // Add to beginning
    currentId = folder.parent_id; // Move to parent
  }
  
  return path; // e.g., ['Videos', 'Tutorials']
}

// Usage:
const path = await getFolderPath(folderId);
console.log(path.join(' > ')); // Videos > Tutorials
```

---

## Renaming Folders

### Rename Any Folder

```bash
curl -X PUT http://localhost:3000/api/folders/b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Python Tutorials"
  }'

# Response:
{
  "success": true
}
```

---

## Deleting Folders

### Delete Empty Folder

```bash
curl -X DELETE http://localhost:3000/api/folders/b2c3d4e5-f6a7-4b6c-9d8e-7f6a5b4c3d2e

# Response:
{
  "success": true
}
```

### Delete Folder with Files

When deleting a folder that contains files:

```
Option 1: Delete cascades (files are also deleted)
Option 2: Files are moved to parent folder
Option 3: Error (prevents accidental data loss)
```

**Current behavior:** Files' `folder_id` is set to NULL (moved to root)

To prevent data loss, move files before deleting:

```bash
# 1. Get all files in folder
curl 'http://localhost:3000/api/files?folder_id=FOLDER_ID'

# 2. Move each file to new folder
# (update file's folder_id via API)

# 3. Delete empty folder
curl -X DELETE http://localhost:3000/api/folders/FOLDER_ID
```

---

## Moving Files Between Folders

### Update File's Folder

```bash
curl -X PUT http://localhost:3000/api/files/file-uuid \
  -H 'Content-Type: application/json' \
  -d '{
    "folder_id": "new-folder-id"
  }'

# Response:
{
  "success": true
}
```

### Move to Root (No Folder)

```bash
curl -X PUT http://localhost:3000/api/files/file-uuid \
  -H 'Content-Type: application/json' \
  -d '{
    "folder_id": null
  }'
```

---

## Folder Structure Examples

### Example 1: Photo Library

```
📁 Photos
├── 📁 2024
│   ├── 📁 Vacation
│   │   ├── beach.jpg
│   │   ├── sunset.jpg
│   │   └── dinner.jpg
│   ├── 📁 Family
│   │   ├── christmas.jpg
│   │   └── birthday.jpg
│   └── 📁 Events
├── 📁 2023
│   ├── 📁 Summer
│   └── 📁 Winter
└── 📁 Archive
    └── (old photos)
```

**Queries:**
```bash
# Get 2024 photos
curl 'http://localhost:3000/api/files?folder_id=<2024-id>'

# Get vacation photos
curl 'http://localhost:3000/api/files?folder_id=<vacation-id>'
```

### Example 2: Project Files

```
📁 Projects
├── 📁 Website-Redesign
│   ├── 📁 Designs
│   │   ├── mockup_v1.psd
│   │   └── mockup_v2.psd
│   ├── 📁 Development
│   │   ├── index.html
│   │   └── styles.css
│   ├── 📁 Assets
│   │   ├── 📁 Images
│   │   ├── 📁 Icons
│   │   └── 📁 Fonts
│   └── contract.pdf
├── 📁 Mobile-App
│   ├── 📁 iOS
│   ├── 📁 Android
│   └── 📁 Design
└── 📁 Archive
```

### Example 3: Video Library

```
📁 Videos
├── 📁 Tutorials
│   ├── 📁 Programming
│   │   ├── 📁 Python
│   │   │   ├── intro.mp4
│   │   │   ├── loops.mp4
│   │   │   └── functions.mp4
│   │   └── 📁 JavaScript
│   ├── 📁 Design
│   └── 📁 Business
├── 📁 Personal
│   ├── 📁 Vlogs
│   ├── 📁 Gaming
│   └── 📁 Music
└── 📁 Downloaded
```

---

## Database Schema

### Folders Table

```sql
CREATE TABLE folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT,                    -- NULL for root folders
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (parent_id) REFERENCES folders(id) 
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_parent_id ON folders(parent_id);
CREATE INDEX idx_name ON folders(name);
```

### Files Table (Updated)

```sql
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  folder_id TEXT,                    -- NULL for root files
  telegram_file_id TEXT UNIQUE NOT NULL,
  original_filename TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id)
    ON DELETE SET NULL              -- Files stay when folder deleted
);

CREATE INDEX idx_folder_id ON files(folder_id);
```

---

## API Endpoints

### Folder Operations

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|-----------|
| `/api/folders` | GET | List folders | `parent_id` (optional) |
| `/api/folders` | POST | Create folder | `name`, `parent_id` (optional) |
| `/api/folders/{id}` | GET | Get folder info | - |
| `/api/folders/{id}` | PUT | Rename folder | `name` |
| `/api/folders/{id}` | DELETE | Delete folder | - |

### File Operations

| Endpoint | Method | Purpose | Parameters |
|----------|--------|---------|-----------|
| `/api/files` | GET | List files | `folder_id` (optional) |
| `/api/files/{id}` | GET | Get file info | - |
| `/api/files/{id}` | PUT | Update file | `folder_id` (optional) |
| `/api/files/{id}` | DELETE | Delete file | - |
| `/api/upload` | POST | Upload file | `folder_id` (optional) |

---

## Best Practices

### Naming Conventions

✅ Good folder names:
```
- "Photos"
- "2024-Projects"
- "Client-Work"
- "Archive-2023"
- "To-Review"
```

❌ Bad folder names:
```
- "asdfgh" (not descriptive)
- "!!!" (too many special chars)
- "very very very long folder name" (unwieldy)
- "📁📁📁" (emoji only)
```

### Organization Tips

1. **Group by category first**
   ```
   ✅ Videos > Tutorials > Python
   ❌ Videos > Python > Tutorials
   ```

2. **Use consistent nesting depth**
   ```
   ✅ 3-4 levels deep maximum
   ❌ 10+ levels (hard to navigate)
   ```

3. **Archive old folders**
   ```
   Create "Archive-2023" folder
   Move old projects there
   Keeps root clean
   ```

4. **Use tags for cross-folder organization**
   ```
   Folder: Projects/Website-Redesign/Assets/Images/Logo
   Tags: logo, branding, 2024
   Makes finding easy with search
   ```

---

## Performance Considerations

### Query Optimization

For fast subfolder listing:

```sql
-- Indexes are automatically created in migration
-- Queries are optimized for:
-- - Getting subfolders of parent: O(log n)
-- - Getting files in folder: O(log n)
-- - Getting folder by ID: O(1)
```

### Large Folder Optimization

If folder has 10,000+ files, use pagination:

```bash
curl 'http://localhost:3000/api/files?folder_id=ID&page=1&limit=50'
```

### File Tree Performance

For displaying entire folder tree in UI:

```javascript
// Don't: Fetch all recursively
// async function getTreeBad(folderId) {
//   const subfolders = await getFoldersByParent(folderId);
//   for (const folder of subfolders) {
//     folder.children = await getTreeBad(folder.id); // N+1 queries!
//   }
// }

// Do: Fetch all once, build tree in memory
async function getTree(rootId) {
  const allFolders = await fetch('/api/folders?parent_id=null')
    .then(r => r.json());
  
  const tree = {};
  for (const folder of allFolders) {
    tree[folder.id] = { ...folder, children: [] };
  }
  
  // Build parent-child relationships O(n)
  for (const folder of Object.values(tree)) {
    if (folder.parent_id && tree[folder.parent_id]) {
      tree[folder.parent_id].children.push(folder);
    }
  }
  
  return tree;
}
```

---

## Troubleshooting

### Problem: Can't create subfolder

**Cause:** Invalid parent_id

**Solution:** Verify parent folder exists
```bash
curl 'http://localhost:3000/api/folders/{parent_id}'
# Should return folder details
```

### Problem: Files disappeared after deleting folder

**Cause:** Files were in deleted folder

**Solution:** Recover from backup or check if moved to root
```bash
curl 'http://localhost:3000/api/files?folder_id=null'
# Shows root-level files
```

### Problem: Folder structure not updating

**Cause:** Browser cache

**Solution:** Hard refresh
```
Mac: Cmd + Shift + R
Windows: Ctrl + Shift + R
```

---

## Summary

| Feature | Status | Depth | Performance |
|---------|--------|-------|-------------|
| Root folders | ✅ | 1 level | O(1) |
| Subfolders | ✅ | Unlimited | O(log n) |
| Nesting | ✅ | Any depth | O(log n) |
| Breadcrumbs | ✅ | Any depth | O(log n) |
| File moving | ✅ | Any folder | O(1) |
| Tree display | ✅ | Any depth | O(n) |

---

**Last Updated:** December 2025
