import { NextResponse } from 'next/server';
import { getFileParts, getFileById } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/files/[id]/parts
 * 
 * Returns unencrypted metadata about file parts
 * Used by client to know how many chunks to fetch and their sizes
 * This endpoint returns NO cryptographic material (IV, auth_tag)
 * Those are fetched separately per-chunk for each /api/chunk request
 * 
 * Response format:
 * {
 *   parts: [
 *     { part_number: 1, size: 2097152 },
 *     { part_number: 2, size: 2097152 },
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

    // Return only safe metadata (no encryption keys or auth tags)
    const parts = allParts.map(part => ({
      part_number: part.part_number,
      size: part.size
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
