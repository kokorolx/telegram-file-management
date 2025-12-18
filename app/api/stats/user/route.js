import { NextResponse } from 'next/server';
import { getUserStats, createUserStats } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    let stats = await getUserStats(auth.user.id);

    // If stats don't exist, create them
    if (!stats) {
      stats = await createUserStats(auth.user.id);
    }

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch user stats' }, { status: 500 });
  }
}
