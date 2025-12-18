import { NextResponse } from 'next/server';
import { getFileStats, getFileById, createFileStats } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { fileId } = params;

    // Verify file belongs to user
    const file = await getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let stats = await getFileStats(fileId);

    // If stats don't exist, create them
    if (!stats) {
      stats = await createFileStats(fileId, auth.user.id);
    }

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get file stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch file stats' }, { status: 500 });
  }
}
