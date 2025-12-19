import { NextResponse } from 'next/server';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/reset-master
 * Resets the master password using login password verification.
 */
export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { loginPassword, newMasterPassword } = await request.json();

    if (!loginPassword || !newMasterPassword) {
      return NextResponse.json(
        { success: false, error: 'Login password and new master password are required' },
        { status: 400 }
      );
    }

    const result = await authService.resetMasterPassword(user.id, loginPassword, newMasterPassword);

    return NextResponse.json({
      success: true,
      message: 'Master password reset successfully',
      salt: result.encryptionSalt
    });

  } catch (error) {
    console.error('Master password reset error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reset master password' },
      { status: 400 }
    );
  }
}
