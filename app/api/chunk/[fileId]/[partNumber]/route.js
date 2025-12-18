import { NextResponse } from 'next/server';
import { getFileById, getFileParts } from '@/lib/db';
import { getFileDownloadUrl } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chunk/[fileId]/[partNumber]
 *
 * Returns encrypted chunk data with IV and auth tag for client-side decryption
 * Server does NOT decrypt - only fetches encrypted blob from Telegram
 *
 * Response format:
 * {
 *   encrypted_data: "base64-encoded-encrypted-bytes",
 *   iv: "hex-encoded-iv",
 *   auth_tag: "hex-encoded-auth-tag",
 *   part_number: 1,
 *   size: 2097152,
 *   total_parts: 5
 * }
 */
export async function GET(request, { params }) {
  try {
    // Verify authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const fileId = params.fileId;
    const partNumber = parseInt(params.partNumber, 10);

    // Validate parameters
    if (!fileId || isNaN(partNumber)) {
      return NextResponse.json(
        { error: 'Missing or invalid file_id or part number' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = await getFileById(fileId);
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
    const parts = await getFileParts(fileId);
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
    // This is the ENCRYPTED data - we do NOT decrypt on server
    const dlUrl = await getFileDownloadUrl(file.user_id, part.telegram_file_id);
    const telegramResponse = await fetch(dlUrl, { next: { revalidate: 0 } });

    if (!telegramResponse.ok) {
      throw new Error(
        `Failed to fetch from Telegram: HTTP ${telegramResponse.status}`
      );
    }

    // Get encrypted buffer (NOT decrypted)
    const encryptedBuffer = Buffer.from(await telegramResponse.arrayBuffer());

    // Return RAW binary data
    // Client already has metadata (IV, auth_tag) from /api/files/[id]/parts
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
