import { NextResponse } from 'next/server';
import { getFile, getFileParts } from '@/lib/db';
import { getFileDownloadUrl } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stream/[fileId]/chunk/[chunkNum]
 *
 * CDN-CACHEABLE endpoint for encrypted video chunks.
 *
 * SECURITY MODEL:
 * - NO AUTH REQUIRED - chunks are encrypted and useless without master password
 * - CDN can cache these safely (1 year cache lifetime)
 * - Client decrypts in browser using master password
 *
 * Returns:
 * - Body: encrypted chunk data (raw bytes from Telegram)
 * - Headers: x-iv, x-auth-tag (needed for decryption)
 * - Cache-Control: public, max-age=31536000
 */
export async function GET(request, { params }) {
  try {
    const { fileId, chunkNum } = params;
    const chunkNumber = parseInt(chunkNum);

    // Validate chunk number
    if (isNaN(chunkNumber) || chunkNumber < 1) {
      return NextResponse.json(
        { error: 'Invalid chunk number' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = await getFile(fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Only encrypted files should use this endpoint
    if (!file.is_encrypted) {
      return NextResponse.json(
        { error: 'File is not encrypted. Use direct download.' },
        { status: 400 }
      );
    }

    // Get all parts for this file
    const parts = await getFileParts(fileId);
    if (!parts || parts.length === 0) {
      return NextResponse.json(
        { error: 'File has no chunks' },
        { status: 404 }
      );
    }

    // Validate chunk number is in range
    if (chunkNumber > parts.length) {
      return NextResponse.json(
        { error: `Chunk ${chunkNumber} not found. File has ${parts.length} chunks.` },
        { status: 404 }
      );
    }

    // Get the requested part
    const part = parts[chunkNumber - 1];
    if (!part) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    // Fetch encrypted chunk from Telegram
    console.log(`CDN-Chunk: Fetching encrypted chunk ${chunkNumber}/${parts.length} for file ${fileId}`);
    const downloadUrl = await getFileDownloadUrl(part.telegram_file_id);
    const telegramResponse = await fetch(downloadUrl);

    if (!telegramResponse.ok) {
      console.error(`Failed to fetch chunk from Telegram: ${telegramResponse.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch chunk from storage' },
        { status: 502 }
      );
    }

    const encryptedData = await telegramResponse.arrayBuffer();
    console.log(`CDN-Chunk: Serving encrypted chunk ${chunkNumber} (${(encryptedData.byteLength / 1024).toFixed(1)} KB)`);

    // Return encrypted chunk with metadata headers
    // CDN can cache this safely - data is encrypted
    return new NextResponse(encryptedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': encryptedData.byteLength.toString(),

        // Encryption metadata (needed for browser-side decryption)
        'x-chunk-number': chunkNumber.toString(),
        'x-total-chunks': parts.length.toString(),
        'x-iv': part.iv,
        'x-auth-tag': part.auth_tag,
        'x-chunk-size': part.size.toString(),

        // Expose headers to browser JavaScript
        'Access-Control-Expose-Headers': 'x-chunk-number, x-total-chunks, x-iv, x-auth-tag, x-chunk-size',

        // CDN caching - 1 year (chunks are immutable and encrypted)
        'Cache-Control': 'public, max-age=31536000, immutable',

        // CORS (if needed for CDN)
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('CDN-Chunk error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
