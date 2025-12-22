import { NextResponse } from 'next/server';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-master
 * DEPRECATED: Use /api/auth/reset-master-with-recovery instead
 * 
 * Master password reset now requires a recovery code for security.
 */
export async function POST(request) {
  return NextResponse.json(
    {
      success: false,
      error: 'Master password reset now requires a recovery code. Please generate recovery codes first in Settings → Security, then use the recovery code to reset your master password.'
    },
    { status: 403 }
  );
}
