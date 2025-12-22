import { NextResponse } from 'next/server';
import { recoveryCodeService } from '@/lib/services/RecoveryCodeService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { isRecoveryCodesEnabled } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/recovery-codes
 * 
 * Lists user's recovery codes (with hashed display).
 * Requires: authenticated user
 * 
 * Response:
 * {
 *   "success": true,
 *   "enabled": true,
 *   "generatedAt": "2024-12-22T10:00:00Z",
 *   "expiresAt": "2025-12-22T00:00:00Z",
 *   "codesRemaining": 9,
 *   "codes": [
 *     {
 *       "id": "uuid",
 *       "display": "XXXX-****-****-MNOP",
 *       "used": false,
 *       "usedAt": null,
 *       "createdAt": "2024-12-22T10:00:00Z"
 *     }
 *   ]
 * }
 */
export async function GET(request) {
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

    const status = await recoveryCodeService.getUserCodeStatus(user.id);
    const codes = await recoveryCodeService.listUserCodes(user.id);

    return NextResponse.json({
      success: true,
      enabled: status.enabled,
      generatedAt: status.generatedAt,
      expiresAt: status.expiresAt,
      codesRemaining: status.remainingCodes,
      totalCodes: status.totalCodes,
      usedCodes: status.usedCodes,
      codes
    });

  } catch (error) {
    console.error('[API] Recovery codes list error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve recovery codes' },
      { status: 500 }
    );
  }
}
