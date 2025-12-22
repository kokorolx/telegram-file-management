import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';
import { userRepository } from '@/lib/repositories/UserRepository';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const sessionUser = getUserFromRequest(request);

    if (!sessionUser || !sessionUser.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const user = await userRepository.findById(sessionUser.id);

    if (!user) {
        return NextResponse.json(
            { success: false, error: 'User not found' },
            { status: 404 }
        );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
