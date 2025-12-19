import { NextResponse } from 'next/server';
import { userBotRepository } from '@/lib/repositories/UserBotRepository';
import { filePartRepository } from '@/lib/repositories/FilePartRepository';
import { requireAuth } from '@/lib/apiAuth';

/**
 * PATCH /api/settings/bots/[botId]
 * Update bot name or default status.
 */
export async function PATCH(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { botId } = params;
    const { name, is_default } = await request.json();

    // Verify bot belongs to user
    const bot = await userBotRepository.findByIdAndUser(botId, auth.user.id);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    if (name !== undefined) {
       await userBotRepository.update(botId, { name, updated_at: new Date() });
    }

    if (is_default !== undefined) {
      if (is_default) {
        await userBotRepository.setDefaultBot(auth.user.id, botId);
      } else {
        await userBotRepository.update(botId, { is_default: false, updated_at: new Date() });
      }
    }

    return NextResponse.json({ success: true, message: 'Bot updated' });
  } catch (error) {
    console.error('Update bot error:', error);
    return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/bots/[botId]
 * Delete a bot.
 */
export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { botId } = params;

    // Verify bot belongs to user
    const bot = await userBotRepository.findByIdAndUser(botId, auth.user.id);

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    // Count files using this bot
    const fileCount = await filePartRepository.countByBotId(botId);

    // Delete bot (cascading deletes bot_usage_stats in DB if configured)
    await userBotRepository.deleteBot(auth.user.id, botId);

    return NextResponse.json({
      success: true,
      message: 'Bot deleted',
      warning: fileCount > 0 ? `${fileCount} file parts were stored with this bot` : null
    });
  } catch (error) {
    console.error('Delete bot error:', error);
    return NextResponse.json({ error: 'Failed to delete bot' }, { status: 500 });
  }
}
