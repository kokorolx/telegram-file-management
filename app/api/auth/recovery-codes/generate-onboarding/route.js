import { NextResponse } from 'next/server';
import { recoveryCodeService } from '@/lib/services/RecoveryCodeService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { isRecoveryCodesEnabled } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/recovery-codes/generate-onboarding
 * 
 * Generates 10 recovery codes during onboarding (after master password setup).
 * Requires: authenticated user (just completed setup)
 * No password verification needed since user just authenticated
 * 
 * Response:
 * {
 *   "success": true,
 *   "codes": ["ABCD-EFGH-IJKL-MNOP", ...],
 *   "expiresAt": "2026-12-22T00:00:00Z"
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

    // Check if codes were already generated on first setup (only allow once)
    const userStatus = await recoveryCodeService.getUserCodeStatus(user.id);
    if (userStatus.generatedOnFirstSetup) {
      return NextResponse.json(
        { success: false, error: 'Recovery codes already generated during onboarding' },
        { status: 403 }
      );
    }

    // Revoke any existing codes (only one active set at a time)
    await recoveryCodeService.revokeAllCodes(user.id, 'regenerated');

    // Generate new codes
    const plainCodes = recoveryCodeService.generateCodes(10);
    
    // Hash codes
    const codeHashes = [];
    for (const code of plainCodes) {
      const hash = await recoveryCodeService.hashCode(code);
      codeHashes.push(hash);
    }

    // Save to database
    const result = await recoveryCodeService.saveCodes(user.id, codeHashes, 365);

    // Mark that codes were generated on first setup
    await recoveryCodeService.setRecoveryCodesGeneratedOnFirstSetup(user.id, true);

    // Log audit event

    return NextResponse.json({
      success: true,
      codes: plainCodes,
      expiresAt: result.expiresAt
    });

  } catch (error) {
    console.error('[API] Recovery codes onboarding error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate recovery codes' },
      { status: 500 }
    );
  }
}
