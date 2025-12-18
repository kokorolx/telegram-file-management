# Multi-Select & Batch Move - Quick Start

## 🚀 What's New

Users can now:
1. **Select multiple files/folders** using checkboxes
2. **Right-click to move** selected items together
3. **See indicator bar** showing what's selected
4. **Move in batch** via modal dialog

## 📋 How to Use

### Select Items
1. Look for **checkboxes** on left side of each file/folder
2. Click checkbox to select ☑️
3. Blue highlight appears = selected
4. **Selection indicator bar** shows at top: "3 items selected | 2 files | 1 folder"

### Move Multiple Items
1. Select items using checkboxes
2. **Right-click** any selected item
3. Click **"Move N items"** in context menu
4. **Modal dialog** opens
5. Choose **destination folder**
6. Click **Move** button
7. Done! Items move to new location

### Delete Multiple Items  
1. Select items
2. Right-click
3. Click **"Delete N items"**
4. Confirm deletion

### Clear Selection
- Click **"Deselect All"** in indicator bar
- Or navigate to different folder
- Or press Escape

## 🎬 Demo Flow

```
User selects 3 files via checkboxes
  ↓
Selection bar shows "3 items selected"
  ↓
Right-click file
  ↓
Context menu: "Move 3 items" | "Delete 3 files" | "Deselect All"
  ↓
Click "Move 3 items"
  ↓
Modal: "Move 3 items (3 files)"
       📁 Root (My Files)
       📁 Documents
       📁 Photos
       [Cancel] [Move]
  ↓
Click "Photos"
  ↓
Click "Move" button
  ↓
Items move, modal closes
  ↓
Selection clears
```

## 🔍 Visual Indicators

### Selection Bar (top of files list)
```
[ 3 items selected | 2 files | 1 folder ]  [Deselect All]
```
- Shows count of selected items
- Shows breakdown by type
- One-click deselect

### File/Folder Highlight
- **Unchecked**: White background, checkbox empty
- **Checked**: Blue background (bg-blue-100), checkbox filled
- **Hover**: Light gray background

### Context Menu
- **Single item**: "Download", "Delete"
- **Multiple items**: "Move N items", "Delete N items", "Deselect All"

## ⚙️ Technical Details

### Files Modified
- `app/[[...folderPath]]/page.jsx` - Main integration
- `app/api/files/move/route.js` - Batch API
- `app/components/FileRow.jsx` - Added checkbox
- `app/components/FolderRow.jsx` - Added checkbox

### Files Added
- `app/components/MoveItemsDialog.jsx` - Move modal
- `app/hooks/useMultiSelect.js` - Selection state
- `app/hooks/useMoveContextMenu.js` - Move functionality
- Documentation files (MULTI_SELECT_FINAL.md, TESTING_GUIDE.md, etc.)

### API Endpoint
```
PATCH /api/files/move
{
  "fileIds": ["id1", "id2"],
  "folderIds": ["id3"],
  "targetFolderId": "target-id"
}
```

## ✅ Checklist

### Before Using
- [ ] Built successfully: `npm run build`
- [ ] No errors in console
- [ ] App running: `npm run dev`
- [ ] You are logged in
- [ ] You have files/folders to move

### Testing
- [ ] Can see checkboxes on files/folders
- [ ] Clicking checkbox selects/deselects
- [ ] Selection bar appears when items selected
- [ ] Right-click shows correct context menu
- [ ] Click "Move" opens modal
- [ ] Modal shows folders
- [ ] Can select destination
- [ ] Move button works
- [ ] Items appear in new location

### Edge Cases (Optional Testing)
- [ ] Move folder with items inside
- [ ] Move to Root (parent_id = null)
- [ ] Move multiple folders together
- [ ] Move file + folder together
- [ ] Delete while modal open
- [ ] Navigate away with selection (clears)

## 🐛 Troubleshooting

### Q: Checkboxes don't appear
**A**: Refresh page, check browser console for errors

### Q: Can't click context menu items
**A**: 
1. Close menu (click outside)
2. Try again
3. Check DevTools console

### Q: Move doesn't work
**A**:
1. Check Network tab in DevTools
2. Look for PATCH request to `/api/files/move`
3. Check response - should be 200 OK
4. Check database to see if file actually moved

### Q: Selection bar doesn't show
**A**: Make sure checkboxes are being clicked (not just hovered)

### Q: Modal doesn't appear after clicking Move
**A**: Check if MoveItemsDialog is imported in page.jsx

## 📚 Full Documentation

- **MULTI_SELECT_FINAL.md** - Complete technical reference
- **TESTING_GUIDE.md** - Comprehensive test cases
- **CONTEXT_MENU_FIX.md** - Context menu architecture

## 🎯 Next Steps

1. **Test the feature** (2-5 minutes)
2. **File bugs** if you find issues
3. **Request enhancements** (keyboard shortcuts, etc.)
4. **Deploy when ready**

## 💡 Tips

- **Faster selection**: Click one item, then Shift+Click another (will be added soon)
- **See what selected**: Look at indicator bar - shows exact count
- **Undo**: Not implemented yet - move carefully!
- **Keyboard**: Escape closes modals

---

That's it! You're ready to use multi-select batch move.
