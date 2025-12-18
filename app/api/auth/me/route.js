import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function GET(request) {
  try {
    const user = getUserFromRequest(request);
    
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
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
