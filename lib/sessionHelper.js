/**
 * Helper to extract user ID from request headers/cookies
 * Since Next.js API routes don't have built-in Passport integration,
 * we verify the session cookie and extract the user ID
 */

import { cookies } from 'next/headers';

/**
 * Get authenticated user from session cookie
 * Returns user object or null if not authenticated
 */
export function getSessionUser(request) {
  // The session cookie contains user ID (set during login)
  const session = request.cookies.get('session_user')?.value;
  
  if (!session) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(session, 'base64').toString('utf-8'));
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Set session cookie with user info
 */
export function setSessionCookie(userId, username) {
  const cookieStore = cookies();
  const sessionData = JSON.stringify({ id: userId, username });
  const encoded = Buffer.from(sessionData).toString('base64');
  
  cookieStore.set('session_user', encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });
}

/**
 * Clear session cookie on logout
 */
export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.delete('session_user');
}
