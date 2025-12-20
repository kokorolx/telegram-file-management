import { NextResponse } from 'next/server';
import { statsService } from '@/lib/services/StatsService';
import { fileService } from '@/lib/fileService';
import { requireAuth } from '@/lib/apiAuth';

/**
 * POST /api/stats/file/[fileId]/view
 * Increment view count for a specific file.
 */
export async function POST(request, { params }) {
  const { fileId } = await params;
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    // Verify file belongs to user
    const file = await fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await statsService.incrementFileView(fileId, auth.user.id);

    return NextResponse.json({ success: true, message: 'View tracked' });
  } catch (error) {
    console.error('Increment file views error:', error);
    return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
  }
}
