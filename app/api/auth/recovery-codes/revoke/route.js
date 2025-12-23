import { NextResponse } from 'next/server';
import { recoveryCodeService } from '@/lib/services/RecoveryCodeService';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { isRecoveryCodesEnabled } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/recovery-codes/revoke
 * 
 * Revokes all unused recovery codes for the user.
 * Requires: authenticated user + login password verification
 * 
 * Request body:
 * {
 *   "loginPassword": "string"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "All recovery codes revoked. Generate new codes to enable recovery again.",
 *   "codesRevoked": 5
 * }
 */
export async function POST(request) {
  try {
    // Feature flag check
    if (!isRecoveryCodesEnabled()) {
      return NextResponse.json(
        { success: false, error: 'Feature not available' },
        { status: 404 }
      );
    }

    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { loginPassword } = await request.json();

    if (!loginPassword) {
      return NextResponse.json(
        { success: false, error: 'Login password is required' },
        { status: 400 }
      );
    }

    // Verify login password
    const isValidPassword = await authService.verifyLoginPassword(user.id, loginPassword);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid login password' },
        { status: 401 }
      );
    }

    // Revoke all codes
    const codesRevoked = await recoveryCodeService.revokeAllCodes(user.id, 'user_request');

    // Log audit event

    return NextResponse.json({
      success: true,
      message: 'All recovery codes revoked. Generate new codes to enable recovery again.',
      codesRevoked
    });

  } catch (error) {
    console.error('[API] Recovery codes revoke error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to revoke recovery codes' },
      { status: 500 }
    );
  }
}
