import { NextResponse } from 'next/server';
import { statsService } from '@/lib/services/StatsService';
import { fileService } from '@/lib/fileService';
import { requireAuth } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats/file/[fileId]
 * Get detailed statistics for a specific file.
 */
export async function GET(request, { params }) {
  const { fileId } = await params;
  try {

    // Verify file belongs to user
    const file = await fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let stats = await statsService.getFileStats(fileId);

    // If stats don't exist, create them
    if (!stats) {
      stats = await statsService.createFileStats(fileId, auth.user.id);
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
