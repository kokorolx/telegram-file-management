import { NextResponse } from 'next/server';
import { statsService } from '@/lib/services/StatsService';
import { folderService } from '@/lib/services/FolderService';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/folder/[folderId]
 * Get detailed statistics for a specific folder.
 */
export async function GET(request, { params }) {
  const { folderId } = await params;
  try {

    // Verify folder belongs to user
    const folder = await folderService.getFolderById(folderId);
    if (!folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    if (folder.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let stats = await statsService.getFolderStats(folderId);

    // If stats don't exist, create them
    if (!stats) {
      stats = await statsService.createFolderStats(folderId, auth.user.id);
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
