# Passport Authentication Implementation

This document outlines the session-based authentication system using Passport.js (local strategy) without JWT tokens.

## Overview

- **Authentication Method**: Passport.js with Local Strategy (username/password)
- **Session Management**: Express-session with PostgreSQL store
- **Database**: User credentials stored in `users` table, sessions in `session` table
- **User Isolation**: All files and folders are tied to `user_id` for complete data isolation

## Key Changes

### 1. Database Schema Updates

#### Users Table
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

#### Session Table
```sql
CREATE TABLE session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
)
```

#### Files & Folders Tables
Added `user_id` column to both tables for data isolation:
- Files now require `user_id` (foreign key to users)
- Folders now require `user_id` (foreign key to users)
- Unique constraints include `user_id` to ensure per-user isolation

### 2. Authentication Flow

#### Login
1. User submits `POST /api/auth/login` with `username` and `password`
2. System looks up user by username and compares password hash (bcryptjs)
3. On success, creates session cookie `session_user` containing base64-encoded user data
4. Cookie is httpOnly, secure (production), sameSite=strict, expires in 7 days

#### Logout
1. User submits `POST /api/auth/logout`
2. System deletes the `session_user` cookie

#### Protected Endpoints
- Middleware checks for `session_user` cookie on all protected `/api/*` routes
- If missing, returns 401 Unauthorized
- Public paths: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`, `/api/setup`, `/api/settings`

### 3. User ID Isolation

Every request to file/folder endpoints:
1. Extracts user ID from session cookie using `getUserFromRequest()`
2. Passes user ID to all database queries
3. Database queries filter results by `user_id`
4. Access control verification ensures users can't access other users' resources

#### Database Query Examples

**Get files for current user:**
```javascript
getFilesByFolder(userId, folderId)
// Filters by: WHERE user_id = $1 AND folder_id = $2
```

**Create folder for current user:**
```javascript
createFolder(folderId, userId, name, parentId)
// Inserts: user_id, name, parent_id, slug
```

**Get all folders for user:**
```javascript
getAllFolders(userId)
// Filters by: WHERE user_id = $1
```

### 4. Session Cookie Format

The `session_user` cookie contains:
```json
{
  "id": "user-uuid",
  "username": "john_doe"
}
```

This is stored as base64-encoded JSON for simple, lightweight storage without requiring a separate session store.

### 5. API Helper Functions

#### `lib/apiAuth.js`
- `getUserFromRequest(request)` - Extracts user from session cookie
- `requireAuth(request)` - Checks authentication and returns user or error

#### `lib/sessionHelper.js`
- `getSessionUser(request)` - Get session user (alternative)
- `setSessionCookie(userId, username)` - Set session cookie
- `clearSessionCookie()` - Clear session cookie

### 6. Endpoint Changes

All file and folder endpoints now require user authentication:

**GET /api/files**
- Requires: `session_user` cookie
- Returns: Files for authenticated user only
- Filters by: `user_id` from session

**GET /api/folders**
- Requires: `session_user` cookie  
- Returns: Folders for authenticated user only
- Filters by: `user_id` from session

**POST /api/folders**
- Requires: `session_user` cookie
- Creates: Folder with `user_id` from session
- Only accessible to the requesting user

### 7. Migration Guide

If migrating from old schema (without user_id):

1. **Backup your database**

2. **Run migrations** (automatic on app startup):
   ```
   npm run setup-db
   ```

3. **Backfill user_id** (if needed):
   ```sql
   -- Create a default admin user if needed
   INSERT INTO users (id, username, password_hash) 
   VALUES ('default-user-id', 'admin', 'hashed_password');
   
   -- Update existing files/folders
   UPDATE files SET user_id = 'default-user-id' WHERE user_id IS NULL;
   UPDATE folders SET user_id = 'default-user-id' WHERE user_id IS NULL;
   ```

## Usage Examples

### Register New User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "securepass123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "john", "password": "securepass123"}' \
  -c cookies.txt
```

### Get Files (with session)
```bash
curl http://localhost:3000/api/files \
  -b cookies.txt
```

### Create Folder (with session)
```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "My Folder"}'
```

### Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## Security Features

1. **Password Hashing**: bcryptjs with salt rounds = 10
2. **Session Cookies**: httpOnly, secure (production), sameSite=strict
3. **User Isolation**: All data queries filtered by user_id
4. **Access Control**: Verification that user owns resources before access
5. **No JWT Tokens**: Uses stateless session cookies instead
6. **SQL Injection Prevention**: Parameterized queries throughout

## Environment Variables

No additional environment variables needed beyond existing setup. 

Session cookie security is automatic:
- `secure` flag set when `NODE_ENV === 'production'`
- `sameSite='strict'` enforces same-site cookie policy
- `httpOnly=true` prevents JavaScript access

## Troubleshooting

### Users can access other users' data
- Check that all endpoints pass `user_id` from session to database queries
- Verify middleware validates `session_user` cookie presence
- Check database schema has correct `WHERE user_id = $X` filters

### Session not persisting
- Verify browser allows cookies
- Check `secure` flag in production (requires HTTPS)
- Check cookie `maxAge` and expiration time

### Folder slugs not unique
- The unique constraint is `(user_id, parent_id, slug)`
- This ensures each user can have same folder names without conflict
- Migration auto-backfills slugs for existing folders

## Dependencies

- `passport` - Authentication middleware
- `passport-local` - Local strategy (username/password)
- `express-session` - Session management
- `connect-pg-simple` - PostgreSQL session store
- `bcryptjs` - Password hashing
