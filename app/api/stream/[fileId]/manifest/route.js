import { NextResponse } from 'next/server';
import { getFile, getFileParts } from '@/lib/db';

/**
 * GET /api/stream/[fileId]/manifest
 * Returns file metadata for progressive streaming initialization
 */
export async function GET(request, { params }) {
  try {
    const { fileId } = params;

    const file = await getFile(fileId);
    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    const parts = await getFileParts(fileId);
    if (!parts || parts.length === 0) {
      return NextResponse.json(
        { error: 'File has no parts' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      fileId,
      filename: file.original_filename,
      fileSize: file.file_size,
      mimeType: file.mime_type,
      isEncrypted: file.is_encrypted,
      encryptionAlgo: file.encryption_algo,
      totalChunks: parts.length,
      chunks: parts.map(p => ({
        number: p.part_number,
        size: p.size
      }))
    });
  } catch (error) {
    console.error('Manifest error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
