# Authentication Flow Testing Guide

## Quick Test (5 minutes)

### Prerequisites
- App running on http://localhost:3000
- PostgreSQL running locally
- .env.local configured

### Test Steps

#### 1. Clear State
```bash
# Open DevTools → Application → Storage → Cookies
# Delete all cookies
# OR run in browser console:
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});
```

#### 2. Setup
- Page loads → Setup Modal shown
- Enter Master Password: `testpass123`
- Confirm: `testpass123`
- Setup Token: Leave as default or enter `default-setup-token`
- Click "Complete Setup"
- Should auto-login and reload
- Login modal should be HIDDEN (already logged in)

#### 3. Verify JWT Token
In DevTools Console:
```javascript
// Get session token
document.cookie.split('; ')
  .find(c => c.startsWith('session_token='))
  .replace('session_token=', '')
  // Copy this token

// Decode JWT (show payload)
const token = 'paste_token_here';
const payload = JSON.parse(atob(token.split('.')[1]));
console.log(payload);
// Should show: { userId: 'xxx-xxx-xxx', mode: 'user', iat: 123456 }
```

#### 4. Test File Fetch
- Network tab → Reload page
- Look for GET /api/files?page=1&...
- Status should be 200 (not 401)
- Response should include empty data array (no files yet)
- Check Auth header in Request: `Cookie: session_token=...`

#### 5. Test Upload (Requires Master Password)
- Click "Upload File"
- Select a file
- Under "Master Password", enter: `testpass123`
- Click Upload
- Should upload successfully
- File should appear in list

#### 6. Verify User Isolation in Database
```sql
-- In PostgreSQL:
SELECT id, user_id, original_filename FROM files LIMIT 5;
-- Should show files with user_id populated

-- Check which user is logged in (from JWT):
SELECT id, username FROM users LIMIT 5;
-- Match the user_id from files to this user
```

#### 7. Register & Login as Different User
- In LoginDialog, click "Sign Up"
- Create new user:
  - Username: `testuser2`
  - Password: `password123`
- Click "Create Account"
- Should say "Account created! Please log in."
- Click "Log In"
- Enter credentials
- Login successful
- GET /api/files should return empty (no files for this user)

#### 8. Verify Previous User's Files Not Visible
- Check Network tab → /api/files returns `[]`
- Previous user's files are not visible
- This proves user isolation works!

#### 9. Test Token Persistence (Server Restart)
```bash
# Keep browser window open with app
# Get current token (from DevTools)
# In terminal, restart dev server:
npm run dev

# Wait for server to restart (10 seconds)
# Page should still work (no login prompt)
# GET /api/files should still work (200)
# Token should be same as before

# Check JWT payload is still valid:
# The token was generated before restart
# With fixed secret, it's still valid!
```

---

## Expected Results

| Test | Expected | Status |
|------|----------|--------|
| Setup completes | Auto-login, no modal | ✓ |
| JWT token in cookie | Present and valid | ✓ |
| GET /api/files | 200 OK with data | ✓ |
| Upload with password | 200 OK, file appears | ✓ |
| User isolation | Other user sees no files | ✓ |
| Token on restart | Still valid (200 OK) | ✓ |
| Master password required | Upload fails without it | ✓ |

---

## Troubleshooting

### 401 on GET /api/files
**Symptoms**: Network tab shows /api/files returning 401

**Check**:
1. Session cookie exists: `document.cookie` should include `session_token=`
2. JWT_SECRET matches: Check .env.local has `JWT_SECRET=...`
3. Check logs for: `[AUTH] No session token found` or `[AUTH] Invalid or expired token`

**Fix**:
```bash
# Check logs
npm run dev 2>&1 | grep AUTH

# If no token found: Manually set cookie (dev only)
# Make request with Bearer token:
curl -H "Authorization: Bearer jwt_token" http://localhost:3000/api/files

# If invalid token: Relogin to get new token with current secret
```

### "userId is required for file access"
**Symptoms**: Upload shows error "userId is required"

**Check**:
1. User logged in? Check auth.userId is not undefined
2. Check insertFile receives user_id parameter
3. Check logs for: `[API/UPLOAD] User ID: undefined`

**Fix**:
```bash
# Verify auth is working first:
curl http://localhost:3000/api/files -b cookies.txt
# Should return 200 with files

# If 401, relogin first
```

### Files not appearing after upload
**Symptoms**: Upload says success, but no files in list

**Check**:
1. Check database: `SELECT * FROM files;`
2. Verify user_id is set: `SELECT user_id FROM files WHERE id = 'xxx';`
3. Check GET /api/files returns data

**Fix**:
```bash
# Check file was inserted:
SELECT COUNT(*) FROM files;

# Check user_id set correctly:
SELECT id, user_id, original_filename FROM files;

# If user_id is NULL: Database issue, re-run migrations
```

### Master password rejected on upload
**Symptoms**: "Invalid master password" error

**Check**:
1. Password matches what was set in setup
2. Case-sensitive!
3. No extra spaces

**Fix**:
```bash
# Check stored hash:
SELECT master_password_hash FROM settings;

# Manually test password validation in Node:
const bcrypt = require('bcryptjs');
const hash = 'hash_from_settings';
bcrypt.compare('your_password', hash).then(result => console.log(result));
```

### Different user can see other user's files
**Symptoms**: User A logs in, sees User B's files

**This is a CRITICAL security issue!**

**Check**:
1. Auth userId extraction working correctly
2. SQL queries include `WHERE user_id = $1`
3. Multiple users actually logged in?

**Verify**:
```bash
# Check two different session_tokens
# Each should have different userId in JWT payload
# Each GET /api/files should return different files

# Check SQL queries:
grep -r "WHERE.*user_id" app/api/
# Should find scoped queries
```

---

## Performance Notes

### Expected Response Times
- GET /api/files: 10-50ms (with pagination)
- POST /upload: 100-500ms (validation only, file processes async)
- POST /auth/login: 50-100ms (bcrypt verify)

### Database Queries
```sql
-- This is fast (indexed):
SELECT * FROM files WHERE user_id = $1 AND folder_id = $2 ORDER BY uploaded_at DESC LIMIT 20;

-- This is slow (full scan):
SELECT * FROM files WHERE original_filename LIKE $1;
-- (But only users' own files scanned)
```

---

## Security Checklist

- [ ] JWT tokens have 7-day expiration
- [ ] Tokens signed with JWT_SECRET
- [ ] All file queries filtered by user_id
- [ ] Upload assigns files to correct user
- [ ] Cross-user file access blocked (404)
- [ ] Master password required for encryption
- [ ] Session cookie is httpOnly (JavaScript can't read)
- [ ] HTTPS enforced in production
- [ ] No passwords logged (except hashes)
- [ ] Tokens not reused across restarts
