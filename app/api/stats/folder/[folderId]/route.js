import { NextResponse } from 'next/server';
import { getFolderStats, getFolderById, createFolderStats } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { folderId } = params;

    // Verify folder belongs to user
    const folder = await getFolderById(folderId);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let stats = await getFolderStats(folderId);

    // If stats don't exist, create them
    if (!stats) {
      stats = await createFolderStats(folderId, auth.user.id);
    }

    return NextResponse.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get folder stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch folder stats' }, { status: 500 });
  }
}
