import { settingRepository } from './repositories/SettingRepository.js';

/**
 * Check if setup is complete (auth token exists)
 * For simple auth, we use a session-based approach via cookies
 */
export async function isSetupComplete() {
  return settingRepository.isSetupComplete();
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

    return {
      authenticated: false,
      error: 'Authentication required. Please log in at /login',
    };

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
 */
export function requireAdmin(request) {
  const user = getUserFromSession(request);

  // 1. For now, since we removed roles, any authenticated user is treated as admin
  // (or you can restrict this to a specific hardcoded username if preferred)
  if (user && user.id) {
    return { authorized: true, user };
  }

  // 2. Fallback for development/localhost if NO session
  const url = new URL(request.url);
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  if (isLocalhost && !user) {
    return { authorized: true, user: { username: 'local-admin' } };
  }

  return {
    authorized: false,
    error: 'Authentication required',
  };
}
