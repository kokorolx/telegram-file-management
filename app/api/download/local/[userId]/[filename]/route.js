import { NextResponse } from 'next/server';
import { LocalStorageProvider } from '@/lib/storage/LocalStorageProvider';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/download/local/[userId]/[filename]
 * Serve encrypted chunks stored in local filesystem for development/testing
 */
export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, filename } = params;

    // Verify user can only access their own files
    if (auth.user?.id !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const localProvider = new LocalStorageProvider();
    const storageId = `local:${userId}:${filename}`;
    const buffer = await localProvider.getFile(storageId);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': buffer.length,
      },
    });
  } catch (error) {
    console.error('[API] Local download error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download file' },
      { status: 404 }
    );
  }
}
