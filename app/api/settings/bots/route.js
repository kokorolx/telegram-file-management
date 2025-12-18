import { NextResponse } from 'next/server';
import { getUserBots, addBotToUser, deleteUserBot, setDefaultBot } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';
import { encryptSystemData } from '@/lib/authService';

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const bots = await getUserBots(auth.user.id);
    return NextResponse.json({ success: true, bots });
  } catch (error) {
    console.error('List bots error:', error);
    return NextResponse.json({ error: 'Failed to list bots' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { name, botToken, tgUserId } = await request.json();

    if (!botToken || !tgUserId) {
      return NextResponse.json({ error: 'Bot token and User ID are required' }, { status: 400 });
    }

    const newBot = await addBotToUser(auth.user.id, {
      name: name || 'Custom Bot',
      botToken: encryptSystemData(botToken),
      tgUserId: encryptSystemData(tgUserId)
    });

    return NextResponse.json({ success: true, bot: newBot });
  } catch (error) {
    console.error('Add bot error:', error);
    return NextResponse.json({ error: 'Failed to add bot' }, { status: 500 });
  }
}
