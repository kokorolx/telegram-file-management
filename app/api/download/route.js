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
            'Content-Disposition': `attachment; filename="${fileRecord.original_filename}"`,
            'Content-Length': fileRecord.file_size,
            'Cache-Control': cacheControl,
        },
    });

  } catch (error) {
     console.error('Download error:', error);
     return NextResponse.json({ success: false, error: 'Download failed' }, { status: 500 });
  }
}


// POST is for Secured/Encrypted Downloads
export async function POST(request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

        // We expect JSON body with { file_id, master_key }
        // Let's assume JSON for key, but return Stream.
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

        // 1. Derive Key from Password
        // Note: In a heavily loaded server, deriving key (scrypt/pbkdf2) on every request is expensive.
        // But for this use case, it's acceptable.
        // Revert to using user password
        const { deriveEncryptionKey } = await import('@/lib/authService');
        const key = await deriveEncryptionKey(master_password);

        // 2. Fetch Parts
        const parts = await getFileParts(file_id);
        if (parts.length === 0) return NextResponse.json({ success: false, error: 'No file parts found' }, { status: 404 });

        // 3. Stream & Decrypt
        const mimeType = fileRecord?.mime_type || 'application/octet-stream';

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for (const part of parts) {
                        const dlUrl = await getFileDownloadUrl(part.telegram_file_id);
                        const res = await fetch(dlUrl);
                        if (!res.ok) throw new Error(`Failed to fetch part ${part.part_number}`);

                        const encryptedBuffer = Buffer.from(await res.arrayBuffer());

                        // Decrypt chunk
                        const decrypted = decryptBuffer(
                            encryptedBuffer,
                            key,
                            Buffer.from(part.iv, 'hex'),
                            Buffer.from(part.auth_tag, 'hex')
                        );

                        controller.enqueue(decrypted);
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
                'Content-Disposition': `attachment; filename="${fileRecord.original_filename}"`,
                'Content-Length': fileRecord.file_size,
                 // No caching for decrypted content in shared caches
                'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            }
        });

    } catch(err) {
        console.error("Secure download error:", err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}

