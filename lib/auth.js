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

    // Allow localhost (development)
    const url = new URL(request.url);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return { authenticated: true };
    }

    // For production, require valid session
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

    return { authenticated: true };
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
