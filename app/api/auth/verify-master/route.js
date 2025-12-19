import { NextResponse } from 'next/server';
import { authService } from '@/lib/authService';
import { userRepository } from '@/lib/repositories/UserRepository';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function POST(request) {
  try {
    const user = getUserFromRequest(request);
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 });
    }

    const isValid = await authService.validateMasterPassword(password, userId);

    if (isValid) {
        const user = await userRepository.findById(userId);
        return NextResponse.json({
          success: true,
          salt: user?.encryption_salt || 'telegram-file-manager-fixed-salt'
        });
    } else {
        return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
