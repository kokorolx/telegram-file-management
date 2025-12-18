# Preview Button Fix - Missing for PDF and Other Files

## Issue
Preview button was missing or not working for:
- PDF files
- Other unsupported file types (Word, Excel, ZIP, etc.)

## Root Cause
In `FileCard.jsx`, the preview button only showed for:
```javascript
const isPreviewable = isImage || isVideo || isAudio;
```

But PreviewModal supports:
- Images ✅
- Videos ✅
- Audio ✅
- PDF ✅ (with iframe)
- All other types ✅ (with emoji thumbnail fallback)

## Fix Applied
**File:** `app/components/FileCard.jsx`

**Before:**
```javascript
const isPreviewable = isImage || isVideo || isAudio;
```

**After:**
```javascript
const isPdf = file.mime_type?.includes('pdf') || file.original_filename?.toLowerCase().endsWith('.pdf');
// Preview button shows for all file types (media + PDF + unsupported file type thumbnails)
const isPreviewable = isImage || isVideo || isAudio || isPdf || true;
```

## Result
Preview button now appears for **ALL file types**:
- ✅ Images (jpg, png, gif, etc.)
- ✅ Videos (mp4, webm, etc.)
- ✅ Audio (mp3, wav, etc.)
- ✅ PDF files (displays with iframe)
- ✅ Documents (Word, Excel, etc. - shows emoji thumbnail)
- ✅ Archives (ZIP, RAR, etc. - shows emoji thumbnail)
- ✅ Code files (JS, Python, etc. - shows emoji thumbnail)
- ✅ Any other file type (shows emoji thumbnail)

## Testing
1. Upload a PDF file
2. Hover over card → **Preview button now visible** ✅
3. Click Preview → PDF displays in modal with iframe
4. Try with Word, Excel, ZIP, etc. → All show preview button
5. Click Preview → All show appropriate icon/thumbnail

## Build Status
✅ `npm run build` - Successful
✅ No errors or warnings
✅ Ready for deployment

## Deployment
No special steps needed. Just deploy with the updated FileCard.jsx
