import { NextRequest, NextResponse } from 'next/server';
import { getFileDownloadUrl } from '@/lib/telegram';
import { getFileById } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file_id');

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: 'Missing file_id parameter' },
        { status: 400 }
      );
    }

    // Get file metadata to get original filename
    const fileRecord = await getFileById(fileId);

    if (!fileRecord) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Get download URL from Telegram
    const downloadUrl = await getFileDownloadUrl(fileRecord.telegram_file_id);

    // Fetch the file from Telegram
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error('Failed to download from Telegram');
    }

    const mimeType = fileRecord?.mime_type || 'application/octet-stream';
    const isImage = mimeType.startsWith('image/');
    const isVideo = mimeType.startsWith('video/');
    const isAudio = mimeType.startsWith('audio/');

    // Determine cache duration based on file type
    let cacheControl = 'public, max-age=86400'; // 1 day default
    if (isImage) {
      cacheControl = 'public, max-age=2592000'; // 30 days for images
    } else if (isVideo || isAudio) {
      cacheControl = 'public, max-age=604800'; // 7 days for video/audio
    }

    // For large files (>10MB), stream instead of loading into memory
    const contentLength = response.headers.get('content-length');
    const fileSize = contentLength ? parseInt(contentLength) : null;
    const shouldStream = fileSize && fileSize > 10 * 1024 * 1024; // 10MB threshold

    if (shouldStream && response.body) {
      // Stream the file (better for large videos)
      // Calculate ETag from file ID and size
      const eTag = `"${Buffer.from(fileId + (fileSize || 0)).toString('base64')}"`;

      if (request.headers.get('if-none-match') === eTag) {
        return new NextResponse(null, { status: 304 });
      }

      return new NextResponse(response.body, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileRecord?.original_filename || 'download'}"`,
          'Content-Length': fileSize || '',
          'Cache-Control': cacheControl,
          'ETag': eTag,
          'Vary': 'Accept-Encoding',
          'Accept-Ranges': 'bytes', // Enable range requests for seeking in videos
        },
      });
    } else {
      // Load small files into memory for compatibility
      const fileData = await response.arrayBuffer();
      const eTag = `"${Buffer.from(fileId + fileData.byteLength).toString('base64')}"`;

      if (request.headers.get('if-none-match') === eTag) {
        return new NextResponse(null, { status: 304 });
      }

      return new NextResponse(fileData, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileRecord?.original_filename || 'download'}"`,
          'Content-Length': fileData.byteLength,
          'Cache-Control': cacheControl,
          'ETag': eTag,
          'Vary': 'Accept-Encoding',
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to download file' },
      { status: 500 }
    );
  }
}
