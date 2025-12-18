# Multi-Select File/Folder Movement Implementation

## Overview
Implemented a Google Drive-like multi-select system for moving files and folders with support for batch operations. Users can now select multiple items and move them together via context menu.

## Features Implemented

### 1. **Multi-Select State Management** (`app/hooks/useMultiSelect.js`)
- Maintains separate `selectedItems` (files) and `selectedFolders` (folders) as Sets
- `toggleFile()` / `toggleFolder()` - Add/remove items from selection
- `clearSelection()` - Clear all selections
- `selectAllFiles()` / `selectAllFolders()` - Batch select
- `hasSelection` - Boolean flag for selection state
- `selectionCount` - Total items selected

### 2. **Enhanced Context Menu Hook** (`app/hooks/useMoveContextMenu.js`)
- Updated `getMoveMenuItems()` to accept selected items/folders instead of single item
- Shows item count in menu label: "Move 3 items" vs "Move to"
- `moveItems()` - Batch API call for moving multiple items
- Supports both files and folders in single operation

### 3. **Batch Move API** (`app/api/files/move/route.js`)
- Enhanced PATCH endpoint to support both single and batch operations
- Accepts `fileIds[]`, `folderIds[]`, or legacy `fileId`/`folderId`
- Returns array of `movedItems` with type and new location
- Handles errors per-item; continues with partial success
- Updates folder stats for each move

### 4. **UI Components Updates**

#### FileRow.jsx
- Added `isSelected` prop and checkbox input
- Checkbox displays selection state with blue highlight
- Prevents default preview on checkbox click
- Backward compatible with existing move button

#### FolderRow.jsx
- Added `isSelected` prop and checkbox input
- Shows selected state with blue background
- Handles drag-drop while selected

#### FileList.jsx
- Receives `selectedItems`, `selectedFolders` from parent
- Passes `onFileSelect` and `onFolderSelect` callbacks
- Shows selection state on both file and folder rows

### 5. **Main Page Integration** (`app/[[...folderPath]]/page.jsx`)
- Integrated `useMultiSelect()` and `useMoveContextMenu()` hooks
- Added **Selection Indicator Bar** showing:
  - Item count breakdown (files vs folders)
  - "Deselect All" button
  - Only shows when items are selected
- Updated `handleContextMenu()` to:
  - Auto-select right-clicked item if not already selected
  - Show batch move menu for multiple selections
  - Show batch delete for multiple selections
  - Maintain single-item context menu for individual items
- Switched to `EnhancedContextMenu` for submenu support

### 6. **Selection Indicator Bar**
Located above search bar in Files Section:
```
Selected: 5 items | 3 files | 2 folders | [Deselect All]
```

## User Workflows

### Move Multiple Files
1. Click checkbox next to files to select (or Ctrl+Click)
2. Right-click any selected file
3. Choose "Move 3 items" → Select destination folder
4. Items move to new location

### Move Mixed Items (Files + Folders)
1. Select files and folders (checkboxes update independently)
2. Right-click any selected item
3. Choose "Move 5 items" → Select destination
4. All items move together

### Delete Multiple Items
1. Select items via checkboxes
2. Right-click any selected item
3. Choose "Delete 3 files" or "Delete 2 folders"
4. Confirm deletion

### Clear Selection
- Click "Deselect All" button in indicator bar
- Click empty area in file list
- Navigate to different folder (clears automatically)

## Database & API

### New API Support
- `/api/files/move` - PATCH (updated)
  - `fileIds[]` - Array of file IDs to move
  - `folderIds[]` - Array of folder IDs to move  
  - `targetFolderId` - Destination folder (or null for root)
  - Returns: `{ success, movedItems[], errors[] }`

### Stats Auto-Update
- `folder_stats.files_count` decrements for source folder
- `folder_stats.files_count` increments for target folder
- `folder_stats.total_size` adjusts for both folders

## Technical Details

### Selection State Storage
- Uses JavaScript `Set` for O(1) lookups
- Stored in component state (non-persistent)
- Cleared on navigation
- Cleared after operations (move/delete)

### Context Menu Behavior
```
Right-click behavior:
- If target is not selected → Select it, show multi-select menu
- If target is selected → Show menu for all selected items
- If nothing selected → Show single-item menu
```

### Checkbox Implementation
- Prevents default click propagation
- Doesn't trigger row click (preview)
- Shift+click support ready (framework in place)

## Files Created/Modified

### New Files
- `app/hooks/useMultiSelect.js` - Selection state management
- `MULTI_SELECT_IMPLEMENTATION.md` - This documentation

### Modified Files
- `app/[[...folderPath]]/page.jsx` - Main page integration
- `app/api/files/move/route.js` - Batch move endpoint
- `app/hooks/useMoveContextMenu.js` - Multi-select context menu
- `app/components/FileRow.jsx` - Added checkbox & selection state
- `app/components/FolderRow.jsx` - Added checkbox & selection state
- `app/components/FileList.jsx` - Passes selection props

## Build Status
✅ **Production build successful** - All 25 routes compiled without errors

## Testing Checklist
- [ ] Select single file via checkbox
- [ ] Select multiple files
- [ ] Select files + folders together
- [ ] Right-click selected items → Move menu appears
- [ ] Move operation succeeds with batch API
- [ ] Selection indicator shows correct count
- [ ] Deselect All button works
- [ ] Navigation clears selection
- [ ] Batch delete works for files
- [ ] Batch delete works for folders
- [ ] Stats update correctly after move
- [ ] Single-item context menu still works

## Future Enhancements
- Shift+Click for range selection
- Ctrl+A for select all
- Keyboard shortcuts (Delete key)
- Drag multiple selected items
- Cut/Copy/Paste support
- Selection persistence with URL query params
