import { NextResponse } from 'next/server';
import { userBotRepository } from '@/lib/repositories/UserBotRepository';
import { requireAuth } from '@/lib/apiAuth';
import { authService } from '@/lib/authService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/bots
 * List all bots for the authenticated user.
 */
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const bots = await userBotRepository.findByUserId(auth.user.id);
    return NextResponse.json({ success: true, bots });
  } catch (error) {
    console.error('List bots error:', error);
    return NextResponse.json({ error: 'Failed to list bots' }, { status: 500 });
  }
}

/**
 * POST /api/settings/bots
 * Add a new bot to the authenticated user.
 */
export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { name, botToken, tgUserId } = await request.json();

    if (!botToken || !tgUserId) {
      return NextResponse.json({ error: 'Bot token and User ID are required' }, { status: 400 });
    }

    const newBot = await userBotRepository.saveBot(auth.user.id, {
      name: name || 'Custom Bot',
      botToken: authService.encryptSystemData(botToken),
      tgUserId: authService.encryptSystemData(tgUserId)
    });

    return NextResponse.json({ success: true, bot: newBot });
  } catch (error) {
    console.error('Add bot error:', error);
    return NextResponse.json({ error: 'Failed to add bot' }, { status: 500 });
  }
}
