import { NextResponse } from 'next/server';
import { statsService } from '@/lib/services/StatsService';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    let stats = await statsService.getUserStats(auth.user.id);

    // If stats don't exist, create them
    if (!stats) {
      stats = await statsService.createUserStats(auth.user.id);
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
