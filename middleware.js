import { NextResponse } from 'next/server';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/setup',
  '/api/settings', // GET /api/settings is used to check setup status
  '/api/share',
  '/api/chunk',
];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Only run on API routes
  if (!pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Check if public path
  const isPublic = PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'));

  // Allow /api/files/[id]/parts if accessed via share
  const isFilePartsPublic = pathname.startsWith('/api/files/') && pathname.endsWith('/parts');

  if (isPublic || isFilePartsPublic) {
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
