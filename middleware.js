import { NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/setup',
  '/api/settings', // GET /api/settings is used to check setup status
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only run on API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Check if public path
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))) {
    return NextResponse.next();
  }

  // Check for authenticated session
  const sessionCookie = request.cookies.get('session_user')?.value;

  if (!sessionCookie) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Pass through
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
