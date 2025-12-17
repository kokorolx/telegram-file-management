import { NextResponse } from 'next/server';
import { getFileDownloadUrl } from '@/lib/telegram';
import { getFileById, getFileParts } from '@/lib/db';
import { deriveEncryptionKey, decryptBuffer } from '@/lib/authService';

export const dynamic = 'force-dynamic';

/**
 * In-memory chunk cache for pre-fetched data
 * Key: `${fileId}:${partNumber}`, Value: { decrypted: Buffer, timestamp: number }
 * Expires after 5 minutes to free up memory
 */
const chunkCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PREFETCH_AHEAD = 3; // Pre-fetch 3 chunks ahead

// Clean old cache entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of chunkCache.entries()) {
        if (now - value.timestamp > CACHE_TTL_MS) {
            chunkCache.delete(key);
        }
    }
}, 60 * 1000); // Clean every minute

/**
 * Fetch and decrypt a chunk, using cache if available
 */
async function fetchAndDecryptChunk(fileId, part, key) {
    const cacheKey = `${fileId}:${part.part_number}`;

    // Check cache first
    const cached = chunkCache.get(cacheKey);
    if (cached) {
        console.log(`Cache HIT for chunk ${part.part_number}`);
        return cached.decrypted;
    }

    // Fetch from Telegram
    console.log(`Fetching chunk ${part.part_number} from Telegram...`);
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

    // Store in cache
    chunkCache.set(cacheKey, { decrypted, timestamp: Date.now() });
    console.log(`Cached chunk ${part.part_number}`);

    return decrypted;
}

/**
 * Pre-fetch chunks in the background (non-blocking)
 */
function prefetchChunks(fileId, parts, startIndex, key) {
    const prefetchPromises = [];

    for (let i = startIndex; i < Math.min(startIndex + PREFETCH_AHEAD, parts.length); i++) {
        const part = parts[i];
        const cacheKey = `${fileId}:${part.part_number}`;

        // Only prefetch if not already in cache
        if (!chunkCache.has(cacheKey)) {
            console.log(`Pre-fetching chunk ${part.part_number}...`);
            prefetchPromises.push(
                fetchAndDecryptChunk(fileId, part, key).catch(err => {
                    console.warn(`Pre-fetch failed for chunk ${part.part_number}:`, err.message);
                })
            );
        }
    }

    // Don't await - let it happen in background
    if (prefetchPromises.length > 0) {
        Promise.all(prefetchPromises).then(() => {
            console.log(`Pre-fetch complete for ${prefetchPromises.length} chunks`);
        });
    }
}

/**
 * Streaming endpoint for encrypted videos/audio with LAZY range request support
 * GET /api/stream?file_id=XXX
 * Authorization: Bearer <master_password> OR ?token=<password>
 *
 * KEY FEATURES:
 * - Lazy chunk loading from Telegram
 * - Pre-fetches next 3 chunks for smooth playback
 * - Caches decrypted chunks in memory for quick seeking
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const fileId = searchParams.get('file_id');

        // Get password from Authorization header OR query param (for video element)
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
            return handleLazyRangeRequest(rangeHeader, parts, key, fileSize, mimeType, fileId);
        }

        // For initial request (no range), use lazy streaming
        return handleLazyFullStream(parts, key, fileSize, mimeType, fileId);

    } catch (err) {
        console.error("Stream error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Lazy full stream with pre-fetching
 */
async function handleLazyFullStream(parts, key, fileSize, mimeType, fileId) {
    let currentPartIndex = 0;

    // Pre-fetch first 3 chunks immediately
    prefetchChunks(fileId, parts, 0, key);

    const stream = new ReadableStream({
        async pull(controller) {
            if (currentPartIndex >= parts.length) {
                controller.close();
                return;
            }

            const part = parts[currentPartIndex];
            currentPartIndex++;

            try {
                // Fetch/decrypt chunk (may hit cache)
                const decrypted = await fetchAndDecryptChunk(fileId, part, key);
                controller.enqueue(decrypted);
                console.log(`Streamed part ${part.part_number}/${parts.length}`);

                // Pre-fetch next chunks in background
                prefetchChunks(fileId, parts, currentPartIndex, key);
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
 * Handle HTTP Range requests with lazy loading and pre-fetching
 */
async function handleLazyRangeRequest(rangeHeader, parts, key, fileSize, mimeType, fileId) {
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
        let firstPartIndex = -1;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const partStart = byteOffset;
            const partEnd = byteOffset + part.size - 1;

            if (partEnd >= start && partStart <= end) {
                partsNeeded.push({ part, byteOffset, index: i });
                if (firstPartIndex === -1) firstPartIndex = i;
            }

            byteOffset += part.size;
            if (byteOffset > end) break;
        }

        // Pre-fetch chunks after the ones we need
        if (firstPartIndex >= 0) {
            const lastNeededIndex = firstPartIndex + partsNeeded.length;
            prefetchChunks(fileId, parts, lastNeededIndex, key);
        }

        let currentPartIdx = 0;

        const stream = new ReadableStream({
            async pull(controller) {
                if (currentPartIdx >= partsNeeded.length) {
                    controller.close();
                    return;
                }

                const { part, byteOffset, index } = partsNeeded[currentPartIdx];
                currentPartIdx++;

                try {
                    console.log(`Range: Processing chunk ${part.part_number} for range ${start}-${end}`);

                    // Fetch/decrypt chunk (may hit cache)
                    const decrypted = await fetchAndDecryptChunk(fileId, part, key);

                    // Slice to match requested byte range
                    const partStart = Math.max(0, start - byteOffset);
                    const partEnd = Math.min(decrypted.length - 1, end - byteOffset);

                    if (partStart <= partEnd) {
                        controller.enqueue(decrypted.subarray(partStart, partEnd + 1));
                    }

                    console.log(`Range: Streamed chunk ${part.part_number}`);

                    // Pre-fetch more chunks
                    prefetchChunks(fileId, parts, index + 1, key);
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
