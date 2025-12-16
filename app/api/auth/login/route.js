import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateMasterPassword, loginUser } from '@/lib/authService';
import { getSettings } from '@/lib/db';

export async function POST(request) {
  try {
    const { password, username } = await request.json();
    const SETUP_TOKEN = process.env.SETUP_TOKEN || 'default-setup-token';

    if (!password) {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    // 1. Check against Setup Token (Admin)
    if (password === SETUP_TOKEN && !username) {
        cookies().set('session_token', 'admin-session', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        });
        return NextResponse.json({ success: true, mode: 'admin' });
    }

    // 2. User Login (Username + Password)
    if (username) {
        const user = await loginUser(username, password);
        if (user) {
            cookies().set('session_token', `user:${user.id}`, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24 * 7
            });
            return NextResponse.json({ success: true, mode: 'user', user });
        } else {
             return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }
    }

    // 3. Fallback: Master Password Login (Legacy/Root)
    const settings = await getSettings();
    if (settings?.master_password_hash) {
        const isValid = await validateMasterPassword(password);
        if (isValid) {
            cookies().set('session_token', 'master-session', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                path: '/',
                maxAge: 60 * 60 * 24 * 7
            });
            return NextResponse.json({ success: true, mode: 'master' });
        }
    }

    return NextResponse.json(
      { success: false, error: 'Invalid password or credentials' },
      { status: 401 }
    );

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
