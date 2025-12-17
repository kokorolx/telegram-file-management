import { NextRequest, NextResponse } from 'next/server';
import { getFile, getFileParts } from '@/lib/db';
import { getFileDownloadUrl } from '@/lib/telegram';

/**
 * GET /api/stream/[fileId]?chunk=1
 *
 * Streams encrypted video chunks to client
 * Client handles decryption in browser using master password
 *
 * Returns:
 * - Headers: x-chunk-number, x-total-chunks, x-iv, x-auth-tag
 * - Body: encrypted chunk data
 */
export async function GET(request, { params }) {
  try {
    const { fileId } = params;
    const { searchParams } = new URL(request.url);
    const chunkNumber = parseInt(searchParams.get('chunk') || '1');

    // Get file metadata
    const file = await getFile(fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Get all parts for this file
    const parts = await getFileParts(fileId);
    if (!parts || parts.length === 0) {
      return NextResponse.json(
        { error: 'File has no parts' },
        { status: 404 }
      );
    }

    // Validate chunk number
    if (chunkNumber < 1 || chunkNumber > parts.length) {
      return NextResponse.json(
        { error: `Invalid chunk number. Valid range: 1-${parts.length}` },
        { status: 400 }
      );
    }

    // Get the requested part (note: part_number is 1-indexed in DB)
    const part = parts[chunkNumber - 1];
    if (!part) {
      return NextResponse.json(
        { error: 'Chunk not found' },
        { status: 404 }
      );
    }

    // Fetch encrypted chunk from Telegram
    const downloadUrl = await getFileDownloadUrl(part.telegram_file_id);
    const chunkResponse = await fetch(downloadUrl);

    if (!chunkResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch chunk from Telegram' },
        { status: 500 }
      );
    }

    const encryptedData = await chunkResponse.arrayBuffer();

    // Return encrypted chunk with metadata in headers
    // Client will use IV and authTag to decrypt
    return new NextResponse(encryptedData, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': encryptedData.byteLength.toString(),
        'x-chunk-number': chunkNumber.toString(),
        'x-total-chunks': parts.length.toString(),
        'x-iv': part.iv, // 12 bytes hex encoded (24 chars)
        'x-auth-tag': part.auth_tag, // 16 bytes hex encoded (32 chars)
        'x-file-size': file.file_size.toString(),
        'x-file-name': file.original_filename,
        'Access-Control-Expose-Headers': 'x-chunk-number, x-total-chunks, x-iv, x-auth-tag, x-file-size, x-file-name',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });
  } catch (error) {
    console.error('Stream error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stream/[fileId]/manifest
 * Returns file metadata for streaming initialization
 */
export async function getManifest(fileId) {
  try {
    const file = await getFile(fileId);
    const parts = await getFileParts(fileId);

    return {
      fileId,
      filename: file.original_filename,
      fileSize: file.file_size,
      mimeType: file.mime_type,
      isEncrypted: file.is_encrypted,
      encryptionAlgo: file.encryption_algo,
      totalChunks: parts.length,
      chunkSize: 2 * 1024 * 1024, // 2MB
    };
  } catch (error) {
    console.error('Manifest error:', error);
    throw error;
  }
}
