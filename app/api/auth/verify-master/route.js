
import { NextResponse } from 'next/server';
import { validateMasterPassword } from '@/lib/authService';

export async function POST(request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 });
    }

    const isValid = await validateMasterPassword(password);

    if (isValid) {
        return NextResponse.json({ success: true });
    } else {
        return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 400 });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
