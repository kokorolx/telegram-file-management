import { NextResponse } from 'next/server';
import { recoveryCodeService } from '@/lib/services/RecoveryCodeService';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { isRecoveryCodesEnabled } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-master-with-recovery
 *
 * Resets the master password using a recovery code.
 * Requires: authenticated user + login password + recovery code
 *
 * Request body:
 * {
 *   "loginPassword": "string",
 *   "recoveryCode": "XXXX-XXXX-XXXX-XXXX",
 *   "newMasterPassword": "string"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Master password reset successfully",
 *   "codesRemaining": 9
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

    const { loginPassword, recoveryCode, newMasterPassword } = await request.json();

    if (!loginPassword || !recoveryCode || !newMasterPassword) {
      return NextResponse.json(
        { success: false, error: 'Login password, recovery code, and new master password are required' },
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

    // Verify recovery code
    const codeVerification = await recoveryCodeService.verifyRecoveryCode(user.id, recoveryCode);
    if (!codeVerification.valid) {
      console.warn(`[AUDIT] Invalid recovery code attempt for user ${user.id}: ${codeVerification.reason}`);
      return NextResponse.json(
        { success: false, error: 'Invalid or expired recovery code' },
        { status: 401 }
      );
    }

    // Reset master password
    const result = await authService.resetMasterPassword(user.id, loginPassword, newMasterPassword);

    // Burn the used recovery code
    await recoveryCodeService.burnCode(codeVerification.codeRecord.id, 'used');

    // Get remaining codes count
    const status = await recoveryCodeService.getUserCodeStatus(user.id);

    // Log audit event
    return NextResponse.json({
      success: true,
      message: 'Master password reset successfully',
      salt: result.encryptionSalt,
      codesRemaining: status.remainingCodes
    });

  } catch (error) {
    console.error('[API] Master password reset with recovery error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset master password' },
      { status: 500 }
    );
  }
}
