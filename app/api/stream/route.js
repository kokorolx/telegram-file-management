import { NextResponse } from 'next/server';
import { getFileDownloadUrl } from '@/lib/telegram';
import { getFileById, getFileParts } from '@/lib/db';
import { deriveEncryptionKey, decryptBuffer } from '@/lib/authService';

export const dynamic = 'force-dynamic';

/**
 * Streaming endpoint for encrypted videos/audio with LAZY range request support
 * GET /api/stream?file_id=XXX
 * Authorization: Bearer <master_password>
 *
 * KEY IMPROVEMENT: Only fetches chunks from Telegram as they're needed,
 * allowing video playback to start after just the first chunk is ready.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('file_id');

        // Get password from Authorization header OR query param (for video element)
        // Query param allows video elements to stream directly since they can't set headers
        let password = searchParams.get('token');

        if (!password) {
            const authHeader = request.headers.get('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                password = authHeader.slice(7);
            }
        }

        if (!password) {
            return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
        }

        if (!fileId) {
            return NextResponse.json({ error: 'Missing file_id' }, { status: 400 });
        }

        const fileRecord = await getFileById(fileId);
        if (!fileRecord) return NextResponse.json({ error: 'File not found' }, { status: 404 });

        if (!fileRecord.is_encrypted) {
            return NextResponse.json({ error: 'File is not encrypted' }, { status: 400 });
        }

        const key = await deriveEncryptionKey(password);
        const parts = await getFileParts(fileId);
        if (parts.length === 0) return NextResponse.json({ error: 'No file parts found' }, { status: 404 });

        const mimeType = fileRecord?.mime_type || 'application/octet-stream';
        const fileSize = fileRecord.file_size;

        // Check for Range header (for video seeking)
        const rangeHeader = request.headers.get('range');
        if (rangeHeader) {
            return handleLazyRangeRequest(rangeHeader, parts, key, fileSize, mimeType, fileRecord.original_filename);
        }

        // For initial request (no range), use lazy streaming with pull-based approach
        return handleLazyFullStream(parts, key, fileSize, mimeType);

    } catch (err) {
        console.error("Stream error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Lazy full stream - fetches chunks one at a time, allowing browser to start playing
 * as soon as first chunk is sent (for properly encoded videos)
 */
async function handleLazyFullStream(parts, key, fileSize, mimeType) {
    let currentPartIndex = 0;

    const stream = new ReadableStream({
        async pull(controller) {
            // This is called when the browser is ready for more data
            if (currentPartIndex >= parts.length) {
                controller.close();
                return;
            }

            const part = parts[currentPartIndex];
            currentPartIndex++;

            try {
                console.log(`Streaming part ${part.part_number}/${parts.length}...`);
                const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
                const res = await fetch(dlUrl, { next: { revalidate: 0 } });

                if (!res.ok) {
                    throw new Error(`Failed to fetch part ${part.part_number}`);
                }

                const encryptedBuffer = Buffer.from(await res.arrayBuffer());
                const decrypted = decryptBuffer(
                    encryptedBuffer,
                    key,
                    Buffer.from(part.iv, 'hex'),
                    Buffer.from(part.auth_tag, 'hex')
                );

                controller.enqueue(decrypted);
                console.log(`Streamed part ${part.part_number}/${parts.length}`);
            } catch (err) {
                console.error(`Error processing part ${part.part_number}:`, err);
                controller.error(err);
            }
        },
        cancel() {
            console.log("Stream cancelled by client");
        }
    });

    return new NextResponse(stream, {
        status: 200,
        headers: {
            'Content-Type': mimeType,
            'Content-Length': fileSize.toString(),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        }
    });
}

/**
 * Handle HTTP Range requests with lazy loading - only fetches needed chunks
 * This is key for video seeking without downloading entire file
 */
async function handleLazyRangeRequest(rangeHeader, parts, key, fileSize, mimeType, filename) {
    try {
        const rangeParts = rangeHeader.replace(/bytes=/, '').split('-');
        const start = parseInt(rangeParts[0], 10) || 0;
        const end = rangeParts[1] ? parseInt(rangeParts[1], 10) : fileSize - 1;

        if (start >= fileSize || start > end) {
            return new NextResponse(null, {
                status: 416,
                headers: { 'Content-Range': `bytes */${fileSize}` },
            });
        }

        // Determine which parts we need for this range
        const partsNeeded = [];
        let byteOffset = 0;

        for (const part of parts) {
            const partStart = byteOffset;
            const partEnd = byteOffset + part.size - 1;

            if (partEnd >= start && partStart <= end) {
                partsNeeded.push({ part, byteOffset });
            }

            byteOffset += part.size;
            if (byteOffset > end) break;
        }

        let currentPartIdx = 0;

        // Use pull-based streaming for lazy loading
        const stream = new ReadableStream({
            async pull(controller) {
                if (currentPartIdx >= partsNeeded.length) {
                    controller.close();
                    return;
                }

                const { part, byteOffset } = partsNeeded[currentPartIdx];
                currentPartIdx++;

                try {
                    console.log(`Range: Fetching part ${part.part_number} for range ${start}-${end}`);
                    const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
                    const res = await fetch(dlUrl, { next: { revalidate: 0 } });

                    if (!res.ok) {
                        throw new Error(`Failed to fetch part ${part.part_number}`);
                    }

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

                    console.log(`Range: Streamed part ${part.part_number}`);
                } catch (err) {
                    console.error(`Error processing part ${part.part_number}:`, err);
                    controller.error(err);
                }
            },
            cancel() {
                console.log("Range stream cancelled by client");
            }
        });

        return new NextResponse(stream, {
            status: 206,
            headers: {
                'Content-Type': mimeType,
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
