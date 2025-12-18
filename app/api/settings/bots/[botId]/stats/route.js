import { NextResponse } from 'next/server';
import { getBotUsageStats, pool } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { botId } = params;

    // Verify bot belongs to user
    const botResult = await pool.query(
      'SELECT * FROM user_bots WHERE id = $1 AND user_id = $2',
      [botId, auth.user.id]
    );

    if (botResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const stats = await getBotUsageStats(botId);

    return NextResponse.json({
      success: true,
      stats: stats || {
        files_count: 0,
        total_size: 0,
        uploads_count: 0
      }
    });
  } catch (error) {
    console.error('Get bot stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch bot stats' }, { status: 500 });
  }
}
