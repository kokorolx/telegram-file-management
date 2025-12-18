# Testing the Multi-Select & Move Feature

## Prerequisites
- App is running (`npm run dev`)
- You are logged in
- You have at least 2 files and 2 folders in current directory

## Quick Test (2 minutes)

### Test 1: Single File Move
1. Right-click any file
2. You should see a context menu with "Move" option
3. Hover over "Move" - a submenu should appear with folder options
4. Click on a destination folder
5. File should move (refresh page if needed to verify)

**Expected**: File context menu appears, submenu with folders, file moves successfully

### Test 2: Multi-File Select and Move
1. Click checkbox next to file #1 ✓
2. Click checkbox next to file #2 ✓
3. Notice: Blue selection indicator bar appears showing "2 items selected"
4. Right-click either selected file
5. Context menu shows "Move 2 items"
6. Hover over "Move 2 items" - submenu appears
7. Click destination folder
8. Both files move

**Expected**: Checkboxes work, selection bar appears, moves both files at once

### Test 3: Mix Files + Folders
1. Click checkbox next to a file
2. Click checkbox next to a folder
3. Selection bar shows "2 items | 1 file | 1 folder"
4. Right-click either
5. Shows "Move 2 items"
6. Both file and folder move together

**Expected**: Can select mixed types, move together successfully

## Detailed Tests

### Context Menu Tests
- [ ] Right-click file → Menu appears at cursor
- [ ] Right-click selected item → Menu shows immediately (no flicker)
- [ ] Hover over "Move" → Submenu appears
- [ ] Submenu shows all accessible folders
- [ ] Submenu shows "Root (My Files)" option
- [ ] Click outside menu → Menu closes
- [ ] Press Escape → Menu closes
- [ ] Press Escape while submenu open → Submenu closes only

### Selection Tests
- [ ] Click checkbox → Item highlights in blue
- [ ] Click checkbox again → Item deselects
- [ ] Selection indicator bar appears when items selected
- [ ] Selection bar shows correct count
- [ ] "Deselect All" button works in indicator bar
- [ ] Selecting file + folder shows both counts
- [ ] Navigating to different folder clears selection

### Move Operation Tests
- [ ] Move single file to another folder
- [ ] Move multiple files to another folder
- [ ] Move single folder to another folder
- [ ] Move multiple folders
- [ ] Move file + folder together
- [ ] Move to Root (My Files)
- [ ] Files/folders appear in destination
- [ ] Files/folders disappear from source
- [ ] Stats update correctly (folder sizes)

### Delete Operation Tests
- [ ] Right-click selected file → Shows "Delete 1 file"
- [ ] Select 2 files, right-click → Shows "Delete 2 files"
- [ ] Right-click selected folder → Shows "Delete 1 folder"
- [ ] Confirm delete → Items deleted
- [ ] Cancel delete → Items remain

### UI Polish Tests
- [ ] Menu doesn't go off-screen (viewport clipping)
- [ ] Submenu appears to right of menu
- [ ] Selection highlight is visible
- [ ] Checkboxes have proper cursor
- [ ] Hover states work on menu items
- [ ] No console errors

## Browser DevTools Debugging

### If menu doesn't appear:
1. Open DevTools (F12)
2. Right-click file
3. Check Console for errors
4. Check Network tab - any failed requests?
5. Check Elements tab - is context menu in DOM?
6. What does `console.log("Context menu")` show?

### If clicks don't work:
1. DevTools → Elements
2. Find the context menu div
3. Click a menu item button
4. See if element is highlighted
5. Check if it has `pointer-events: none`
6. Check parent elements for same

### If move doesn't happen:
1. Network tab → Check `PATCH /api/files/move` request
2. Look at request body - are selected IDs included?
3. Check response status - is it 200 OK?
4. Check response body - does it say `{ success: true }`?
5. Console → Any errors after move?

## Debug Console Commands

```javascript
// Check selected items (run in browser console)
// (No direct access, but you can verify via:)
// 1. Right-click file
// 2. Look at context menu items

// Check API endpoint manually
fetch('/api/files/move', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileIds: ['file-id-here'],
    folderIds: [],
    targetFolderId: 'folder-id-here'
  })
}).then(r => r.json()).then(d => console.log(d))
```

## Common Issues & Fixes

### Issue: "Menu doesn't appear"
**Check**:
- Is `onContextMenu` being called? (Add `e.preventDefault()` check)
- Is `setContextMenu()` receiving items array?
- Are browser extensions blocking context menu?

**Fix**:
- Disable browser extensions temporarily
- Check browser console for errors
- Verify `handleContextMenu` is defined in page.jsx

### Issue: "Can't click menu items"
**Check**:
- Are clicks reaching the buttons?
- DevTools → Elements → Inspector, click menu button, see if highlighted?
- Is there a `pointer-events: none` on menu?

**Fix**:
- Verify `onClick` handler on buttons
- Check `e.stopPropagation()` is present
- Verify z-index is correct (menu should be z-100)

### Issue: "Move doesn't work"
**Check**:
- Network tab: Does PATCH request show in Network tab?
- Response: Does it return `200 OK`?
- Database: Did the file actually move? (Check database directly)

**Fix**:
- Verify API endpoint `/api/files/move` exists
- Check auth: Is user authenticated?
- Check IDs: Are file/folder IDs valid?

### Issue: "Selection bar doesn't appear"
**Check**:
- Are checkboxes clickable?
- Do checkboxes have `checked` state?
- Is `hasSelection` being calculated correctly?

**Fix**:
- Verify checkbox `onChange` handler
- Check `toggleFile()` is updating state
- Verify state is being passed to FileRow

## Performance Considerations

- Large folder lists (100+) in submenu might be slow
- Consider adding search/filter for folders
- Consider pagination if many items to move

## Next Steps After Fixing

1. Document any issues found
2. Add error handling if needed
3. Consider keyboard shortcuts (Ctrl+M for move, Del for delete)
4. Consider drag-drop as alternative to right-click
5. Add analytics tracking for move/delete operations
