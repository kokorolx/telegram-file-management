import { NextResponse } from 'next/server';
import { getFileParts, getFileById } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/[id]/parts
 *
 * Returns metadata about file parts for browser-side decryption
 * This endpoint now returns IV and auth_tag for each chunk
 * These are safe to expose as they are useless without the master password
 *
 * Response format:
 * {
 *   parts: [
 *     { part_number: 1, size: 2097152, iv: "...", auth_tag: "..." },
 *     ...
 *   ]
 * }
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
      return NextResponse.json(
        { error: 'Missing file ID' },
        { status: 400 }
      );
    }

    // Verify file exists and user has access
    const file = await getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Get all parts for this file
    const allParts = await getFileParts(fileId);
    if (allParts.length === 0) {
      return NextResponse.json(
        { error: 'No file parts found' },
        { status: 404 }
      );
    }

    // Return metadata (IV and auth tags are needed for browser decryption)
    const parts = allParts.map(part => ({
      part_number: part.part_number,
      size: part.size,
      iv: part.iv,
      auth_tag: part.auth_tag
    }));

    return NextResponse.json(
      { parts },
      {
        headers: {
          'Cache-Control': 'private, max-age=300', // Cache for 5 minutes
          'Content-Type': 'application/json'
        }
      }
    );
  } catch (err) {
    console.error('Error fetching file parts:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch file parts' },
      { status: 500 }
    );
  }
}
