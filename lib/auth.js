// Authentication utilities
import { getSettings } from './db.js';

/**
 * Check if setup is complete (auth token exists)
 * For simple auth, we use a session-based approach via cookies
 */
export async function isSetupComplete() {
  try {
    const settings = await getSettings();
    return !!settings?.setup_complete;
  } catch (err) {
    return false;
  }
}

/**
 * Get user from session cookie (session_user)
 * This is the new authentication method using session_user cookie
 */
export function getUserFromSession(request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) {
    return null;
  }

  const cookies = Object.fromEntries(
    cookieHeader.split('; ').map(c => c.split('='))
  );
  
  const sessionCookie = cookies['session_user'];
  if (!sessionCookie) {
    return null;
  }

  try {
    const decoded = Buffer.from(decodeURIComponent(sessionCookie), 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error('[auth.js] Failed to decode session_user:', err);
    return null;
  }
}

/**
 * Verify session from request
 * Looks for session token in cookies or Authorization header
 */
export function getSessionToken(request) {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('='))
    );
    return cookies['session_token'];
  }

  return null;
}

/**
 * Generate a session token (simple hash-based)
 * In production, use proper JWT or session management
 */
export function generateSessionToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Middleware to check if user is authenticated
 * Must be setup complete AND have valid session or be from localhost
 * Returns user object if authenticated
 */
export async function requireAuth(request) {
  try {
    // Check if setup is complete
    const setupComplete = await isSetupComplete();
    if (!setupComplete) {
      return {
        authenticated: false,
        error: 'Setup not complete. Please visit /setup',
      };
    }

    // Try new session_user cookie first (modern auth)
    const user = getUserFromSession(request);
    if (user && user.id) {
      return { authenticated: true, user };
    }

    // Fall back to old session_token for backwards compatibility
    const token = getSessionToken(request);
    if (!token) {
      return {
        authenticated: false,
        error: 'Authentication required. Please log in at /login',
      };
    }

    // Basic token validation (in production, validate against database/JWT)
    if (token.length < 20) {
      return {
        authenticated: false,
        error: 'Invalid session token',
      };
    }

    return { authenticated: true, user: null };
  } catch (err) {
    console.error('Auth check error:', err);
    return {
      authenticated: false,
      error: 'Authentication failed',
    };
  }
}

/**
 * Middleware to check if user is admin (for settings/management)
 * Currently based on setup token
 */
export function requireAdmin(request) {
  // Check if this is coming from localhost or has admin token
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  
  if (isLocalhost) {
    return { authorized: true };
  }

  // For production, would check admin role in database
  return {
    authorized: false,
    error: 'Admin access required',
  };
}
