import { NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/[id]/parts
 *
 * Returns metadata about file parts for browser-side decryption.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    // Verify authentication OR valid share token
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share_token');

    let isAuthorized = auth.authenticated;

    if (!isAuthorized && shareToken) {
        const { sharedLinkRepository } = await import('@/lib/repositories/SharedLinkRepository');
        const sharedLink = await sharedLinkRepository.findByToken(shareToken);
        if (sharedLink && sharedLink.file_id === id) {
            // Check expiry
            if (!sharedLink.expires_at || new Date(sharedLink.expires_at) > new Date()) {
                isAuthorized = true;
            }
        }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = id;
    if (!fileId) {
      return NextResponse.json({ error: 'Missing file ID' }, { status: 400 });
    }

    // Verify file exists
    const file = await fileService.getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get all parts for this file
    const allParts = await fileService.getFileParts(fileId);
    if (allParts.length === 0) {
      return NextResponse.json({ error: 'No file parts found' }, { status: 404 });
    }

    // Return parts with file metadata
    return NextResponse.json({
      parts: allParts.map(p => ({
        part_number: parseInt(p.part_number, 10),
        size: parseInt(p.size, 10),
        iv: p.iv,
        auth_tag: p.auth_tag,
        is_compressed: p.is_compressed || false,
      })),
      file: {
        id: file.id,
        original_filename: file.original_filename,
        mime_type: file.mime_type,
        file_size: file.file_size,
        is_fragmented: file.is_fragmented || false,  // Include fragmentation status
        key_data: file.encrypted_file_key ? {
             encrypted_key: file.encrypted_file_key, // Server stored field name
             iv: file.key_iv // Server stored field name
        } : null
      }
    }, { status: 200 });
  } catch (err) {
    console.error('Error fetching file parts:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch file parts' }, { status: 500 });
  }
}
