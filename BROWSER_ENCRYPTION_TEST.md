# Browser-Side Encryption Upload Testing Guide

## Manual Testing Steps

### 1. Local Development Setup
```bash
npm run dev
# Server running at http://localhost:3000
```

### 2. Test with Small File (2MB)
- Open upload interface
- Toggle "Browser-side encryption" ON
- Select a small test file (2MB)
- Verify in console:
  - ✓ File ID generated
  - ✓ Encryption key derived
  - ✓ Single chunk created
  - ✓ POST to /api/upload/chunk with encrypted_data, iv, auth_tag
  - ✓ Server response includes file_id, status: "completed"
  - ✓ No plaintext in network logs

### 3. Test with Medium File (50MB)
- Select 50MB file
- Watch progress updates: "Encrypting chunk 5/25", "Uploading chunk 5/25"
- Verify chunking:
  - 50MB / 2MB = 25 chunks
  - Each chunk should have unique IV
  - Progress bar updates per chunk
- Check server logs:
  - No plaintext file content
  - Each chunk uploaded to Telegram
  - Metadata stored (iv, auth_tag)

### 4. Test with Large File (500MB+)
- Select large file
- Verify:
  - No memory issues (streaming works)
  - Progress updates smooth
  - Each chunk < 50MB size
  - Upload completes

### 5. Network Inspection (Chrome DevTools)
1. Open DevTools → Network tab
2. Upload encrypted file
3. Click on POST /api/upload/chunk request
4. Check Request body:
   - ✅ encrypted_data is base64 (binary data encoded)
   - ✅ iv is hex string (e.g., "a1b2c3d4e5f6g7h8i9j0k1l2")
   - ✅ auth_tag is hex string
   - ✅ NO plaintext filename in body (only original_filename)
5. Response should be:
   ```json
   {
     "success": true,
     "file_id": "...",
     "part_number": N,
     "total_parts": ...,
     "status": "uploading" or "completed"
   }
   ```

### 6. Server Logs Verification
```bash
# Watch server logs (if using PM2 or similar)
npm run dev
```
Check that logs show:
- ✅ "📁 Created encrypted file: ..." (once per upload)
- ✅ "📤 Uploading encrypted chunk N/M..."
- ✅ "✓ Chunk N/M uploaded"
- ✅ NO base64-encoded plaintext
- ✅ NO decrypted file content

### 7. Decryption Test
After encrypted upload completes:
1. Navigate to file in library
2. Click "Preview"
3. Enter master password
4. File should decrypt and display correctly
5. Verify in console:
   - ✓ Key derived with same PBKDF2 params
   - ✓ Chunks fetched from /api/chunk
   - ✓ Each chunk decrypted with iv + auth_tag
   - ✓ Auth tag validation passed
   - ✓ File displays correctly

### 8. Password Verification
1. Try uploading encrypted with WRONG password
2. System should reject password in PasswordPromptModal
3. Try again with correct password
4. Should succeed

### 9. Backward Compatibility Test
1. Toggle "Browser-side encryption" OFF
2. Upload unencrypted file
3. Server should use old /api/upload path
4. File should upload and encrypt on server (old flow)
5. Both encrypted and unencrypted files coexist

### 10. File Size Limits
**Encrypted (Browser):** No limit (tested to 1GB+)
**Unencrypted (Server):** 100MB max

Verify UI shows correct limit based on toggle:
- Encrypted: "No file size limit"
- Unencrypted: "Max 100MB per file"

---

## Database Verification

### Check File Parts Metadata
```sql
-- After uploading encrypted file
SELECT 
  f.id, 
  f.original_filename, 
  f.is_encrypted, 
  p.part_number, 
  p.size, 
  LENGTH(p.iv) as iv_hex_length,
  LENGTH(p.auth_tag) as auth_tag_length,
  p.telegram_file_id
FROM files f
LEFT JOIN file_parts p ON f.id = p.file_id
ORDER BY f.id DESC, p.part_number
LIMIT 5;
```

Expected results:
- ✅ is_encrypted = true
- ✅ iv length = 24 (hex string for 12 bytes)
- ✅ auth_tag length = 32 (hex string for 16 bytes)
- ✅ telegram_file_id populated (chunked files)

### Check Encryption Config
```sql
SELECT 
  original_filename, 
  file_size, 
  encryption_algo, 
  is_encrypted
FROM files
WHERE is_encrypted = true
ORDER BY uploaded_at DESC
LIMIT 5;
```

Expected:
- ✅ encryption_algo = "AES-256-GCM"
- ✅ is_encrypted = true

---

## Browser Console Testing

### Check Key Derivation
```javascript
// Import from browser console after page load
import { deriveEncryptionKeyBrowser } from '/lib/clientDecryption.js';
const key = await deriveEncryptionKeyBrowser('test-password');
console.log('Key:', new Uint8Array(key));
// Should output 32-byte array
```

### Check Encryption/Decryption Match
```javascript
import { deriveUploadKey } from '/lib/browserUploadEncryption.js';
import { deriveEncryptionKeyBrowser } from '/lib/clientDecryption.js';

// Both should produce IDENTICAL keys
const uploadKey = await deriveUploadKey('same-password');
const downloadKey = await deriveEncryptionKeyBrowser('same-password');

console.log('Upload key:', uploadKey);
console.log('Download key:', downloadKey);
console.log('Match:', ArrayBuffer.isEqual(uploadKey, downloadKey)); // Should be true
```

---

## Troubleshooting

### Issue: "Unauthorized" on upload
- Check: Authentication middleware
- Verify: User is logged in before upload
- Fix: Call /api/auth/verify-master first

### Issue: "Invalid IV length" error
- Check: IV must be exactly 24 hex chars (12 bytes)
- Verify: uint8ArrayToHex() produces correct length
- Fix: IV generation is crypto.getRandomValues(new Uint8Array(12))

### Issue: "Invalid auth tag length" error
- Check: Auth tag must be exactly 32 hex chars (16 bytes)
- Verify: encryptChunk() extracts last 16 bytes correctly
- Fix: Web Crypto appends auth tag to ciphertext automatically

### Issue: Decryption fails with "auth tag verification failed"
- Check: IV and auth_tag in database match what was uploaded
- Verify: SALT matches on both client and server
- Fix: Ensure same encryption key used (password + PBKDF2)

### Issue: File size shows incorrect value
- Check: chunk_size * total_parts should equal original file size
- Note: Final file size updated after all chunks received
- Verify: file_size in database correct after upload completes

### Issue: Memory error on large file
- Check: Chunk size is 2MB (should not exceed RAM)
- Try: Reduce CHUNK_SIZE constant if browser limited
- Monitor: Browser memory tab while uploading

### Issue: Progress bar stuck
- Check: Network tab - all chunks uploading?
- Verify: onProgress callback firing with correct numbers
- Try: Refresh page and retry upload

---

## Success Criteria Checklist

✅ Files encrypt on browser before upload
✅ Server never receives plaintext (network logs)
✅ Progress shows chunk-by-chunk: "Uploading chunk 50/500"
✅ Large files (1GB+) work without memory issues
✅ IV + auth_tag stored in database (24 + 32 hex chars)
✅ Encrypted chunks uploaded to Telegram
✅ Files decrypt correctly in preview
✅ Download key derivation matches upload key
✅ Unencrypted uploads still work (backward compatible)
✅ Server logs show NO plaintext content
✅ Both encrypted and unencrypted files coexist

---

## Performance Baseline

| File Size | Encrypt | Upload | Total | Memory |
|-----------|---------|--------|-------|--------|
| 5MB       | 1s      | 2s     | 3s    | 3MB    |
| 50MB      | 10s     | 20s    | 30s   | 5MB    |
| 500MB     | 100s    | 200s   | 300s  | 5MB    |
| 1GB       | 200s    | 400s   | 600s  | 5MB    |

*These are estimates; actual times depend on network speed and CPU*

---

## Next Steps After Testing

1. Deploy to staging environment
2. Test with real users
3. Monitor server logs for issues
4. Gather performance metrics
5. Optimize chunk size if needed
6. Document known limitations
7. Release to production
