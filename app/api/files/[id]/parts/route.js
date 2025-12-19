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
  try {
    // Verify authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.id;
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

    // Return metadata
    const parts = allParts.map(part => ({
      part_number: part.part_number,
      size: part.size,
      iv: part.iv,
      auth_tag: part.auth_tag
    }));

    return NextResponse.json({ parts }, {
      headers: {
        'Cache-Control': 'private, max-age=300',
        'Content-Type': 'application/json'
      }
    });
  } catch (err) {
    console.error('Error fetching file parts:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch file parts' }, { status: 500 });
  }
}
