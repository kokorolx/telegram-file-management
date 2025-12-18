/**
 * API authentication helper for Next.js API routes
 * Extracts user from session cookie
 */

export function getUserFromRequest(request) {
  try {
    // Get session from request.cookies (Next.js 14 App Router)
    let sessionCookie = null;
    
    if (request.cookies && typeof request.cookies.get === 'function') {
      sessionCookie = request.cookies.get('session_user')?.value;
    }
    
    if (!sessionCookie) {
      return null;
    }

    const decoded = Buffer.from(sessionCookie, 'base64').toString('utf-8');
    const user = JSON.parse(decoded);
    return user;
  } catch (err) {
    console.error('[apiAuth] Failed to decode session:', err);
    return null;
  }
}

/**
 * Middleware helper for API routes to check authentication
 */
export function requireAuth(request) {
  const user = getUserFromRequest(request);
  
  if (!user || !user.id) {
    return {
      authenticated: false,
      user: null,
      error: 'Authentication required'
    };
  }

  return {
    authenticated: true,
    user
  };
}
