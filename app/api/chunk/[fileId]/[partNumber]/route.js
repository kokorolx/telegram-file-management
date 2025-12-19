import { NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';
import { getFileDownloadUrl } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chunk/[fileId]/[partNumber]
 *
 * Returns encrypted chunk data for client-side decryption.
 */
export async function GET(request, { params }) {
  const { fileId, partNumber: partNumberParam } = await params;
  try {
    // Verify authentication OR valid share token
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share_token');

    let isAuthorized = auth.authenticated;
    let authorizedUserId = auth.user?.id;

    if (!isAuthorized && shareToken) {
        const { sharedLinkRepository } = await import('@/lib/repositories/SharedLinkRepository');
        const sharedLink = await sharedLinkRepository.findByToken(shareToken);
        if (sharedLink && sharedLink.file_id === fileId) {
            // Check expiry
            if (!sharedLink.expires_at || new Date(sharedLink.expires_at) > new Date()) {
                isAuthorized = true;
                authorizedUserId = sharedLink.user_id; // Use owner's ID for Telegram access
            }
        }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partNumber = parseInt(partNumberParam, 10);

    // Validate parameters
    if (!fileId || isNaN(partNumber)) {
      return NextResponse.json(
        { error: 'Missing or invalid file_id or part number' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = await fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only encrypted files use this endpoint
    if (!file.is_encrypted) {
      return NextResponse.json(
        { error: 'File is not encrypted - use /api/download instead' },
        { status: 400 }
      );
    }

    // Get all parts to find the requested one
    const parts = await fileService.getFileParts(fileId);
    if (parts.length === 0) {
      return NextResponse.json(
        { error: 'No file parts found' },
        { status: 404 }
      );
    }

    const part = parts.find(p => p.part_number === partNumber);
    if (!part) {
      return NextResponse.json(
        { error: `Chunk ${partNumber} not found` },
        { status: 404 }
      );
    }

    // Fetch encrypted blob from Telegram
    const dlUrl = await getFileDownloadUrl(authorizedUserId || file.user_id, part.telegram_file_id);
    const telegramResponse = await fetch(dlUrl, { next: { revalidate: 0 } });

    if (!telegramResponse.ok) {
      throw new Error(`Failed to fetch from Telegram: HTTP ${telegramResponse.status}`);
    }

    const encryptedBuffer = Buffer.from(await telegramResponse.arrayBuffer());

    return new NextResponse(encryptedBuffer, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Content-Type': 'application/octet-stream',
        'Content-Length': encryptedBuffer.length.toString(),
        'X-Part-Number': part.part_number.toString(),
      }
    });
  } catch (err) {
    console.error('Chunk fetch error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch chunk' },
      { status: 500 }
    );
  }
}
