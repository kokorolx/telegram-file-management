import { NextResponse } from 'next/server';
import { deleteUserBot, setDefaultBot, pool } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function PATCH(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { botId } = params;
    const { name, is_default } = await request.json();

    // Verify bot belongs to user
    const botResult = await pool.query(
      'SELECT * FROM user_bots WHERE id = $1 AND user_id = $2',
      [botId, auth.user.id]
    );

    if (botResult.rows.length === 0) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }

    if (is_default !== undefined) {
      if (is_default) {
        await setDefaultBot(auth.user.id, botId);
      } else {
        updates.push(`is_default = $${paramCount++}`);
        values.push(false);
      }
    }

    if (updates.length > 0) {
      values.push(botId);
      await pool.query(
        `UPDATE user_bots SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    }

    return NextResponse.json({ success: true, message: 'Bot updated' });
  } catch (error) {
    console.error('Update bot error:', error);
    return NextResponse.json({ error: 'Failed to update bot' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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

    // Count files using this bot
    const filesResult = await pool.query(
      'SELECT COUNT(*) as count FROM file_parts WHERE bot_id = $1',
      [botId]
    );

    const fileCount = parseInt(filesResult.rows[0].count) || 0;

    // Delete bot (cascade will handle file_parts and bot_usage_stats)
    await deleteUserBot(auth.user.id, botId);

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
