# Passport Authentication - Quick Start

## Installation

Dependencies have been added to `package.json`. Install with:

```bash
npm install
npm run setup-db
```

## Quick Test

### 1. Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "password123"
  }'
```

### 2. Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "password": "password123"
  }' \
  -c cookies.txt
```

This sets the `session_user` cookie in `cookies.txt`.

### 3. Access Protected Route
```bash
curl http://localhost:3000/api/files \
  -b cookies.txt
```

Returns only files for the authenticated user.

### 4. Create Folder
```bash
curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My Documents"
  }'
```

### 5. Logout
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

## Code Example: Frontend

### React Login Component
```javascript
async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Include cookies
    body: JSON.stringify({ username, password })
  });

  if (response.ok) {
    const data = await response.json();
    console.log('Logged in as:', data.user.username);
    // Redirect to dashboard
  } else {
    console.error('Login failed');
  }
}

// After login, all subsequent requests automatically include the session cookie:
async function getFiles() {
  const response = await fetch('/api/files', {
    credentials: 'include' // Auto-includes session_user cookie
  });
  const data = await response.json();
  return data.data; // User's files only
}
```

## Code Example: Backend Update

When updating an endpoint, add user extraction:

```javascript
import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';
import { getFilesByFolder } from '@/lib/db';

export async function GET(request) {
  // Extract user from session
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Query with user_id
  const files = await getFilesByFolder(user.id, null);

  return NextResponse.json({
    success: true,
    data: files
  });
}
```

## Key Concepts

### Session Cookie
- Name: `session_user`
- Content: Base64-encoded JSON with `id` and `username`
- Secure: httpOnly, secure (production), sameSite=strict
- Duration: 7 days

### User Isolation
Every file and folder request:
1. Extracts user from session cookie
2. Passes `user_id` to database functions
3. Database filters by `user_id`
4. Result: User only sees their own data

### Authentication Check
```javascript
const user = getUserFromRequest(request);
if (!user) {
  // Return 401 Unauthorized
}
```

### Authorization Check (for specific resources)
```javascript
const file = await getFileById(fileId);
if (file.user_id !== user.id) {
  // Return 403 Forbidden
}
```

## Testing Different Users

```bash
# User 1
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user1", "password": "pass1"}' \
  -c user1.txt

# User 2
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "user2", "password": "pass2"}' \
  -c user2.txt

# User 1 creates folder
FOLDER=$(curl -X POST http://localhost:3000/api/folders \
  -H "Content-Type: application/json" \
  -b user1.txt \
  -d '{"name": "Secret"}' | jq -r '.data.id')

# User 2 tries to access (should fail)
curl http://localhost:3000/api/files?folder_id=$FOLDER \
  -b user2.txt
# Returns: { "error": "Access denied" }
```

## Common Issues

### "Authentication required" on protected route
- Check that session cookie is being sent
- Verify cookie name is `session_user`
- Check that login endpoint is working

### User sees other users' files
- Verify `user_id` is being extracted from session
- Check that all DB queries include user filtering
- Verify endpoint is checking `user.id` in queries

### Folder slug conflicts between users
- This is normal - unique constraint is `(user_id, parent_id, slug)`
- Each user can have folders with same name without conflict

## Next: Complete Remaining Endpoints

See `PASSPORT_IMPLEMENTATION_NEXT_STEPS.md` for:
- Updating upload endpoints with user_id
- Updating file/folder management endpoints
- Updating download/stream endpoints
- Complete testing checklist

## Documentation

- `PASSPORT_AUTHENTICATION.md` - Full technical documentation
- `PASSPORT_IMPLEMENTATION_SUMMARY.md` - What was implemented
- `PASSPORT_IMPLEMENTATION_NEXT_STEPS.md` - What still needs updating
