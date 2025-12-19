import { NextResponse } from 'next/server';
import { statsService } from '@/lib/services/StatsService';
import { userBotRepository } from '@/lib/repositories/UserBotRepository';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { botId } = await params;
  try {

    // Verify bot belongs to user
    const bot = await userBotRepository.findByIdAndUser(botId, auth.user.id);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const stats = await statsService.getBotUsageStats(botId);

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
