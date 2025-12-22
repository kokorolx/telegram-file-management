import { NextResponse } from 'next/server';
import { recoveryCodeService } from '@/lib/services/RecoveryCodeService';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { isRecoveryCodesEnabled } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/recovery-codes/generate
 * 
 * Generates 10 new recovery codes for the user.
 * Requires: authenticated user + login password + master password verification
 * 
 * Request body:
 * {
 *   "loginPassword": "string",
 *   "masterPassword": "string"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "codes": ["ABCD-EFGH-IJKL-MNOP", ...],
 *   "expiresAt": "2026-12-22T00:00:00Z",
 *   "warning": "Save these codes in a secure location..."
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

    const { loginPassword, masterPassword } = await request.json();

    if (!loginPassword || !masterPassword) {
      return NextResponse.json(
        { success: false, error: 'Login password and master password are required' },
        { status: 400 }
      );
    }

    // Verify login password
    const isValidLoginPassword = await authService.verifyLoginPassword(user.id, loginPassword);
    if (!isValidLoginPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid login password' },
        { status: 401 }
      );
    }

    // Verify master password
    const isValidMasterPassword = await authService.validateMasterPassword(masterPassword, user.id);
    if (!isValidMasterPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid master password' },
        { status: 401 }
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

    // Log audit event
    console.log(`[AUDIT] Recovery codes generated for user ${user.id}`);

    return NextResponse.json({
      success: true,
      codes: plainCodes,
      expiresAt: result.expiresAt,
      warning: 'Save these codes in a secure location. They are one-time use only and cannot be recovered if lost.'
    });

  } catch (error) {
    console.error('[API] Recovery codes generation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate recovery codes' },
      { status: 500 }
    );
  }
}
