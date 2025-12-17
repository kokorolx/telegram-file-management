import { NextRequest, NextResponse } from 'next/server';
import { getFileDownloadUrl } from '@/lib/telegram';
import { getFileById } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ... imports
import { getMasterKeyFromRequest, deriveEncryptionKey, decryptBuffer } from '@/lib/authService';
import { getFileParts } from '@/lib/db';


export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('file_id');
    if (!fileId) return NextResponse.json({ success: false, error: 'Missing file_id' }, { status: 400 });

    const fileRecord = await getFileById(fileId);
    if (!fileRecord) return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });

    const mimeType = fileRecord?.mime_type || 'application/octet-stream';
    let cacheControl = 'public, max-age=86400';
    if (mimeType.startsWith('image/')) cacheControl = 'public, max-age=2592000';
    if (fileRecord.is_encrypted) cacheControl = 'private, no-cache, no-store, must-revalidate'; // Safer for encrypted

    // Handle Encrypted File
    if (fileRecord.is_encrypted) {
        return NextResponse.json({ success: false, error: 'File is encrypted. Use POST with master_password.' }, { status: 400 });
    }

    // Normal Unencrypted File
    if (!fileRecord.telegram_file_id) {
         // Should not happen for unencrypted unless corrupted?
         // Actually, legacy files might be missing it if upload failed?
         return NextResponse.json({ success: false, error: 'File content missing' }, { status: 404 });
    }

    const downloadUrl = await getFileDownloadUrl(fileRecord.telegram_file_id);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
        throw new Error(`Telegram API responded with ${response.status}`);
    }

    return new NextResponse(response.body, {
        status: 200,
        headers: {
            'Content-Type': mimeType,
            'Content-Disposition': encodeContentDispositionFilename(fileRecord.original_filename),
            'Content-Length': fileRecord.file_size.toString(),
            'Cache-Control': cacheControl,
        },
    });

  } catch (error) {
     console.error('Download error:', error);
     return NextResponse.json({ success: false, error: 'Download failed' }, { status: 500 });
  }
}


// POST is for Secured/Encrypted Downloads - with streaming support
export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

        const body = await request.json();
        const { file_id, master_password } = body;

        if (!file_id || !master_password) {
            return NextResponse.json({ success: false, error: 'Missing file_id or master_password' }, { status: 400 });
        }

        const fileRecord = await getFileById(file_id);
        if (!fileRecord) return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });

        if (!fileRecord.is_encrypted) {
             return NextResponse.json({ success: false, error: 'File is not encrypted. Use GET.' }, { status: 400 });
        }

        // Derive Key from Password
        const { deriveEncryptionKey } = await import('@/lib/authService');
        const key = await deriveEncryptionKey(master_password);

        // Fetch Parts (metadata only, actual decryption happens on-demand)
        const parts = await getFileParts(file_id);
        if (parts.length === 0) return NextResponse.json({ success: false, error: 'No file parts found' }, { status: 404 });

        const mimeType = fileRecord?.mime_type || 'application/octet-stream';
        const fileSize = fileRecord.file_size;

        // Check for Range header (for video seeking/streaming)
        const rangeHeader = request.headers.get('range');
        if (rangeHeader && (mimeType.startsWith('video/') || mimeType.startsWith('audio/'))) {
            // Support range requests for efficient video/audio streaming
            return handleRangeRequest(rangeHeader, parts, key, fileSize, mimeType, fileRecord.original_filename);
        }

        // Stream entire decrypted file with on-demand fetching
        // Don't fetch all parts upfront - only fetch as we stream
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for (const part of parts) {
                        try {
                            // Fetch encrypted part from Telegram
                            const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
                            const res = await fetch(dlUrl);
                            if (!res.ok) throw new Error(`Failed to fetch part ${part.part_number}`);

                            // Read and decrypt on-demand (not all at once)
                            const encryptedBuffer = Buffer.from(await res.arrayBuffer());

                            // Decrypt this part
                            const decrypted = decryptBuffer(
                                encryptedBuffer,
                                key,
                                Buffer.from(part.iv, 'hex'),
                                Buffer.from(part.auth_tag, 'hex')
                            );

                            // Stream to browser immediately
                            controller.enqueue(decrypted);
                            
                            console.log(`Streamed part ${part.part_number}/${parts.length}`);
                        } catch (partErr) {
                            console.error(`Error processing part ${part.part_number}:`, partErr);
                            throw partErr;
                        }
                    }
                    controller.close();
                } catch (e) {
                    console.error("Stream error", e);
                    controller.error(e);
                }
            }
        });

        return new NextResponse(stream, {
            status: 200,
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': encodeContentDispositionFilename(fileRecord.original_filename),
                'Content-Length': fileSize.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            }
        });

    } catch(err) {
        console.error("Secure download error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

/**
 * Encode filename for Content-Disposition header (RFC 5987)
 * Handles Unicode characters properly
 */
function encodeContentDispositionFilename(filename) {
  // Check if filename has non-ASCII characters
  if (/^[\x20-\x7E]*$/.test(filename)) {
    // Pure ASCII - use simple format
    return `attachment; filename="${filename}"`;
  }
  // Has Unicode - use RFC 5987 encoding with percent-encoded UTF-8
  // Encode each byte of the UTF-8 representation
  const utf8Bytes = Buffer.from(filename, 'utf8');
  let encoded = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    const byte = utf8Bytes[i];
    // Unreserved characters don't need encoding
    if ((byte >= 0x41 && byte <= 0x5A) || // A-Z
        (byte >= 0x61 && byte <= 0x7A) || // a-z
        (byte >= 0x30 && byte <= 0x39) || // 0-9
        byte === 0x2D || byte === 0x2E || byte === 0x5F || byte === 0x7E) { // - . _ ~
      encoded += String.fromCharCode(byte);
    } else {
      encoded += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
    }
  }
  return `attachment; filename*=UTF-8''${encoded}`;
}

/**
 * Handle HTTP Range requests for encrypted files
 * Allows clients (browsers, video players) to seek through the file efficiently
 */
async function handleRangeRequest(rangeHeader, parts, key, fileSize, mimeType, filename) {
    try {
        // Parse range header: "bytes=0-1023" or "bytes=1024-"
        const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(rangeParts[0], 10) || 0;
        const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;

        if (start >= fileSize || start > end) {
            return new NextResponse(null, {
                status: 416,
                headers: {
                    'Content-Range': `bytes */${fileSize}`,
                },
            });
        }

        // Determine which parts to fetch based on byte range
        const partsNeeded = [];
        let byteOffset = 0;

        for (const part of parts) {
            const partStart = byteOffset;
            const partEnd = byteOffset + part.size - 1;

            // Check if this part overlaps with requested range
            if (partEnd >= start && partStart <= end) {
                partsNeeded.push({ part, byteOffset });
            }

            byteOffset += part.size;
            if (byteOffset > end) break; // Stop once we've covered the range
        }

        // Create stream for partial content
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for (const { part, byteOffset } of partsNeeded) {
                        const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
                        const res = await fetch(dlUrl);
                        if (!res.ok) throw new Error(`Failed to fetch part ${part.part_number}`);

                        const encryptedBuffer = Buffer.from(await res.arrayBuffer());
                        const decrypted = decryptBuffer(
                            encryptedBuffer,
                            key,
                            Buffer.from(part.iv, 'hex'),
                            Buffer.from(part.auth_tag, 'hex')
                        );

                        // Slice to match requested byte range
                        const partStart = Math.max(0, start - byteOffset);
                        const partEnd = Math.min(decrypted.length - 1, end - byteOffset);

                        if (partStart <= partEnd) {
                            controller.enqueue(decrypted.subarray(partStart, partEnd + 1));
                        }
                    }
                    controller.close();
                } catch (e) {
                    console.error("Range stream error", e);
                    controller.error(e);
                }
            }
        });

        return new NextResponse(stream, {
            status: 206, // Partial Content
            headers: {
                'Content-Type': mimeType,
                'Content-Disposition': encodeContentDispositionFilename(filename),
                'Content-Length': (end - start + 1).toString(),
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            }
        });

    } catch (err) {
        console.error("Range request error:", err);
        return new NextResponse(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

