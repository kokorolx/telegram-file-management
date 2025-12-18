# Authorization & Access Control Guide

Secure your file manager with authentication and granular access control.

---

## Overview

The file manager implements a **session-based authentication system**:

1. **Setup Phase:** Configure credentials at `/setup`
2. **Session Phase:** Valid sessions can access files
3. **Download Phase:** Downloads require authenticated session

---

## Current Authentication Flow

### Development Mode (Localhost)

```
localhost:3000 → Any request → Allowed
No authentication needed for local testing
```

**Use Cases:**
- Local development
- Testing
- Private server behind firewall

### Production Mode (Remote Server)

```
Public IP → Requires session token → Allowed
Public IP → No session token → Denied (401 Unauthorized)
```

---

## Setting Up Authentication

### Step 1: Initial Setup

First user sets up credentials:

1. Visit `http://your-domain.com/setup`
2. Enter Telegram Bot Token
3. Enter Telegram User ID
4. Click "Complete Setup"
5. **Session cookie is set** automatically

### Step 2: Using the App

All subsequent requests include session cookie automatically:

```
Browser → Request + session_token cookie → API
```

The browser automatically sends cookies with requests (no manual action needed).

---

## Session Token System

### How Session Tokens Work

1. **Creation**
   - Generated when setup is completed
   - Stored in `session_token` cookie
   - Valid for 24 hours (configurable)

2. **Storage**
   ```
   Browser Cookie: session_token=abcd1234...
   Server: Validates token format/validity
   ```

3. **Automatic Inclusion**
   ```
   All API requests include:
   Cookie: session_token=abcd1234...
   ```

4. **Expiration**
   - Tokens expire after 24 hours
   - Need to log in again
   - Automatic redirect to login

### Token Format

```
Format: 32 random alphanumeric characters
Example: AbCd1234EfGh5678IjKl9012MnOp3456
```

---

## Authentication Methods

### Method 1: Browser Cookies (Default)

**Best for:** Web UI users

```javascript
// Automatic - no code needed
// Browser handles cookie with every request
fetch('/api/download?file_id=abc123')
// Automatically includes: Cookie: session_token=...
```

### Method 2: Authorization Header

**Best for:** API clients, mobile apps, scripts

```bash
curl 'http://localhost:3000/api/download?file_id=abc123' \
  -H 'Authorization: Bearer YOUR_SESSION_TOKEN'
```

**JavaScript:**
```javascript
fetch('/api/download?file_id=abc123', {
  headers: {
    'Authorization': `Bearer ${sessionToken}`
  }
})
```

### Method 3: Query Parameter (Not Recommended)

```bash
# Works but less secure (tokens visible in URLs)
curl 'http://localhost:3000/api/download?file_id=abc123&token=SESSION_TOKEN'
```

---

## Protected Endpoints

### Requires Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/download` | GET | Download files |
| `/api/files` | GET | List files |
| `/api/folders` | GET | List folders |

**Error if not authenticated:**
```json
{
  "success": false,
  "error": "Authentication required. Please log in at /login"
}
```

### Public Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/setup` | GET | Setup page |
| `/api/settings` | GET | Check setup status |

---

## Access Control Examples

### Scenario 1: Local Development

```
✅ ALLOWED
- localhost:3000 → any request
- 127.0.0.1:3000 → any request
- No session needed
```

### Scenario 2: Sharing App with Friends

1. Deploy to `files.yourname.com`
2. Each friend visits setup page once
3. After setup, has persistent access
4. Session lasts 24 hours (auto-renew on login)

```
✅ ALLOWED
- files.yourname.com → request with session cookie
- Session token: abcd1234...

❌ DENIED
- files.yourname.com → request without session
- Error: 401 Unauthorized
```

### Scenario 3: API Access (Automation)

```bash
# Get session token first
TOKEN=$(curl -X POST http://files.yourname.com/api/login \
  -d 'password=YOUR_PASSWORD' | jq -r '.token')

# Use token for API requests
curl 'http://files.yourname.com/api/download?file_id=abc123' \
  -H "Authorization: Bearer $TOKEN"
```

---

## Implementing Custom Authentication

### Option 1: Password-Based Login

Edit `app/api/login/route.js`:

```javascript
import { NextResponse } from 'next/server';
import { generateSessionToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const { password } = await request.json();
    
    // Check password
    const correctPassword = process.env.LOGIN_PASSWORD || 'default-password';
    if (password !== correctPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid password' },
        { status: 401 }
      );
    }
    
    // Generate session token
    const token = generateSessionToken();
    
    // Return token (client stores in cookie)
    return NextResponse.json({
      success: true,
      token: token,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### Option 2: API Key Based

Edit `lib/auth.js`:

```javascript
export function requireApiKey(request) {
  const apiKey = request.headers.get('X-API-Key');
  const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
  
  if (!validKeys.includes(apiKey)) {
    return { authenticated: false, error: 'Invalid API key' };
  }
  
  return { authenticated: true };
}
```

Usage:

```bash
curl 'http://localhost:3000/api/download?file_id=abc123' \
  -H 'X-API-Key: your-secret-key-here'
```

### Option 3: JWT Tokens

Install JWT library:

```bash
npm install jsonwebtoken
```

Edit `lib/auth.js`:

```javascript
import jwt from 'jsonwebtoken';

export function verifyJWT(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { authenticated: true, user: decoded };
  } catch (error) {
    return { authenticated: false, error: 'Invalid token' };
  }
}

export function generateJWT(userId) {
  return jwt.sign(
    { userId, iat: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}
```

---

## Security Best Practices

### Do's ✅

- **Use HTTPS** - Always encrypt in transit
  ```
  https://files.yourname.com (✅ Good)
  http://files.yourname.com (❌ Not secure)
  ```

- **Set strong passwords** - For admin access
  ```
  ✅ Correct-Horse-Battery-Staple
  ❌ password123
  ```

- **Rotate tokens regularly** - Or use short expiration
  ```
  Token expiry: 24 hours (good)
  Token expiry: 90 days (risky)
  ```

- **Validate all inputs** - Before processing
  ```javascript
  if (!fileId || !isValidUUID(fileId)) {
    return error('Invalid file ID');
  }
  ```

- **Use environment variables** - For secrets
  ```
  ✅ process.env.JWT_SECRET (stored in .env.local)
  ❌ const secret = 'hardcoded-secret' (visible in code)
  ```

### Don'ts ❌

- **Don't log tokens** - They're sensitive
  ```javascript
  ❌ console.log('Token:', token);
  ✅ console.log('Token length:', token.length);
  ```

- **Don't store tokens in localStorage** - Use secure cookies
  ```javascript
  ❌ localStorage.setItem('token', token);
  ✅ Document.cookie = 'session_token=...; Secure; HttpOnly';
  ```

- **Don't use same token for everyone** - Generate unique tokens
  ```javascript
  ❌ const token = 'default-token-123';
  ✅ const token = generateSessionToken();
  ```

- **Don't expose tokens in URLs** - Send in headers/cookies
  ```
  ❌ /api/download?file_id=abc&token=xyz123
  ✅ /api/download?file_id=abc with Authorization header
  ```

- **Don't disable HTTPS in production** - Always use HTTPS
  ```javascript
  ❌ if (NODE_ENV === 'production') disable_ssl = true;
  ✅ Always require HTTPS
  ```

---

## Environment Variables

### Required for Authentication

Add to `.env.local`:

```bash
# For JWT-based auth
JWT_SECRET=your-secret-key-here-at-least-32-chars

# For password-based auth
LOGIN_PASSWORD=your-secure-password

# For API keys
VALID_API_KEYS=key1,key2,key3

# Session duration (seconds)
SESSION_TIMEOUT=86400
```

### Optional for Advanced Setup

```bash
# Admin credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password

# Rate limiting
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600

# Token signing
TOKEN_ISSUER=your-app-name
TOKEN_AUDIENCE=your-app-users
```

---

## Testing Authentication

### Test 1: Verify Localhost Works

```bash
# Should work without auth
curl 'http://localhost:3000/api/files'

# Response:
# { "success": true, "data": [...] }
```

### Test 2: Verify Remote Requires Auth

```bash
# Should fail
curl 'http://files.yourname.com/api/files'

# Response:
# { "success": false, "error": "Authentication required..." }
```

### Test 3: Test with Session Token

```bash
# Should work
curl 'http://files.yourname.com/api/files' \
  -H 'Cookie: session_token=your-token'

# Response:
# { "success": true, "data": [...] }
```

---

## Troubleshooting

### Problem: "Authentication required" on localhost

**Cause:** Authorization is enforced even on localhost

**Solution:** Check your environment
```bash
# Should show localhost
echo $HOSTNAME
# If not localhost, you're on remote server
```

### Problem: Session expires too quickly

**Solution:** Increase token expiration in `lib/auth.js`

```javascript
export async function generateSessionToken() {
  // Token valid for 7 days instead of 24 hours
  // Implementation depends on your token system
}
```

### Problem: Can't log in after setup

**Solution:** Clear cookies and try again

**Chrome DevTools:**
1. Open DevTools (F12)
2. Application → Cookies → localhost:3000
3. Delete `session_token` cookie
4. Refresh page and log in

### Problem: API key not working

**Solution:** Check header name

```bash
# Correct
curl ... -H 'X-API-Key: your-key'

# Wrong (case-sensitive)
curl ... -H 'x-api-key: your-key'

# Wrong (different header name)
curl ... -H 'Authorization: your-key'
```

---

## Production Deployment

### Vercel Deployment

1. **Set environment variables** in Vercel dashboard:
   ```
   JWT_SECRET = (generate random 32-char string)
   LOGIN_PASSWORD = (set strong password)
   TELEGRAM_BOT_TOKEN = (your token)
   TELEGRAM_USER_ID = (your user id)
   DATABASE_URL = (your postgres url)
   ```

2. **Enable HTTPS** - Automatic on Vercel

3. **Set custom domain** - In Vercel settings

4. **Test authentication:**
   ```bash
   curl 'https://your-app.vercel.app/api/files'
   # Should return 401 Unauthorized (expected)
   ```

### Self-Hosted Deployment

1. **Use reverse proxy** (nginx/Apache) with HTTPS
2. **Enable CORS** if needed
3. **Set all environment variables**
4. **Test thoroughly** before going live

---

## API Reference

### Check Authentication Status

```bash
GET /api/settings
```

**Response:**
```json
{
  "success": true,
  "setup_complete": true,
  "requires_auth": true
}
```

### Logout (Clear Session)

```bash
POST /api/logout

# Client should delete session_token cookie
```

### Refresh Session

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "token": "current-token"
}

Response:
{
  "success": true,
  "token": "new-token"
}
```

---

## Summary

| Feature | Status | Details |
|---------|--------|---------|
| Session cookies | ✅ Enabled | Default auth method |
| Authorization headers | ✅ Enabled | For API clients |
| Localhost bypass | ✅ Enabled | Development convenience |
| HTTPS enforcement | ⚠️ Manual | Use reverse proxy |
| Password login | ❌ Optional | Can implement |
| API keys | ❌ Optional | Can implement |
| JWT tokens | ❌ Optional | Can implement |
| Rate limiting | ❌ Optional | Can implement |

---

**Last Updated:** December 2025
