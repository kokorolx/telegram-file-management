/**
 * Helper to extract user ID from request headers/cookies
 * Since Next.js API routes don't have built-in Passport integration,
 * we verify the session cookie and extract the user ID
 */

import { cookies } from 'next/headers';
import { config } from './config.js';
import { getRedisClient } from './redis.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Get authenticated user from session cookie or Redis
 * Returns user object or null if not authenticated
 */
export async function getSessionUser(request) {
  const sessionCookie = request.cookies.get('session_user')?.value;

  if (!sessionCookie) {
    return null;
  }

  if (config.isEnterprise && config.redisUrl) {
    const redis = getRedisClient();
    if (redis) {
      const userData = await redis.get(`session:${sessionCookie}`);
      return userData ? JSON.parse(userData) : null;
    }
  }

  try {
    const decoded = JSON.parse(Buffer.from(sessionCookie, 'base64').toString('utf-8'));
    return decoded;
  } catch (err) {
    return null;
  }
}

/**
 * Set session cookie with user info
 */
export async function setSessionCookie(userId, username) {
  const cookieStore = cookies();
  const sessionData = { id: userId, username };
  let cookieValue;

  if (config.isEnterprise && config.redisUrl) {
    const redis = getRedisClient();
    if (redis) {
      const sessionId = uuidv4();
      await redis.set(`session:${sessionId}`, JSON.stringify(sessionData), 'EX', 60 * 60 * 24 * 7);
      cookieValue = sessionId;
    }
  }

  if (!cookieValue) {
    cookieValue = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  }

  cookieStore.set('session_user', cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });
}

/**
 * Clear session cookie and Redis session on logout
 */
export async function clearSessionCookie() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('session_user')?.value;

  if (config.isEnterprise && config.redisUrl && sessionCookie) {
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`session:${sessionCookie}`);
    }
  }

  cookieStore.delete('session_user');
}
