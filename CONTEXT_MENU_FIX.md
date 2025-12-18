# Context Menu Fix Documentation

## Issues Fixed

### 1. **EnhancedContextMenu Click Issues**
- **Problem**: Overlay div with `inset-0` was blocking clicks to menu items
- **Solution**: 
  - Added `onClick={onClose}` to overlay for background click detection
  - Added `onClick={(e) => e.stopPropagation()}` to menu container to prevent propagation to overlay
  - Removed problematic `handleClickOutside` listener that was interfering

### 2. **Submenu Not Closing Properly**
- **Problem**: Submenu wasn't properly handling mouse leave
- **Solution**: 
  - Added `onMouseLeave={handleMouseLeave}` to submenu container
  - Added `onClick={(e) => e.stopPropagation()}` to submenu to prevent closing when clicking items

### 3. **Pointer Events**
- **Problem**: Z-index and overlay might cause pointer event issues
- **Solution**: Explicitly set `pointerEvents: 'auto'` on overlay div

## Testing Steps

1. **Right-click on a file or folder**
   - Context menu should appear at cursor position
   
2. **Click on a menu item WITHOUT submenu**
   - Item should execute immediately
   - Menu should close
   
3. **Hover on a menu item WITH submenu**
   - Submenu should appear to the right
   - Show destination folders
   
4. **Click on a destination folder in submenu**
   - Move operation should execute
   - Menu should close
   - Files should appear in new location after refresh

5. **Click outside menu**
   - Menu should close
   
6. **Press Escape**
   - If submenu open: close submenu only
   - If no submenu: close entire menu

## Debugging Steps

If clicks still don't work:

1. Open browser DevTools
2. Check Console for errors
3. Verify context menu is rendering in DOM (Elements tab)
4. Check Network tab when move button is clicked
5. Verify API response: `/api/files/move` should return `200 OK` with moved items

## Move Operation Flow

```
User right-clicks file
  ↓
handleContextMenu() called
  ↓
Auto-selects file if not already selected
  ↓
Creates context menu with getMoveMenuItems()
  ↓
User hovers "Move X items"
  ↓
Submenu appears with folder list
  ↓
User clicks destination folder
  ↓
moveItems() API call:
  POST /api/files/move
  {
    fileIds: [id1, id2],
    folderIds: [id3],
    targetFolderId: "target-id"
  }
  ↓
API verifies ownership
  ↓
Database updates folder_id for each file/folder
  ↓
Stats updated for source & target folders
  ↓
Response: { success: true, movedItems: [...] }
  ↓
clearSelection() called
  ↓
setRefreshTrigger() forces file list reload
  ↓
Items appear in new location
```

## Common Issues

### Menu doesn't appear
- Check: Is `onContextMenu` handler being called?
- Check: Is `setContextMenu()` receiving items?
- Check: Is context menu z-index correct (z-[100])?

### Menu appears but can't click items
- Check: Are clicks reaching the buttons?
- DevTools → Elements → Click menu item, check if button element is highlighted
- Check for pointer-events: none in parent elements

### Move doesn't work
- Check Network tab: Is PATCH request being sent?
- Check response: Does it return `{ success: true }`?
- Check browser console: Any errors?
- Verify API: Can you PATCH `/api/files/move` manually?

### Wrong folders shown in submenu
- Check: Does `getMoveMenuItems()` receive correct folders array?
- Check: Does `useMoveContextMenu` hook have updated folders list?
- Verify: Are you passing `folders` state to the hook?
