import { NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';
import { getFileDownloadUrl } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/chunk/[fileId]/[partNumber]
 *
 * Returns encrypted chunk data for client-side decryption.
 */
export async function GET(request, { params }) {
  const { fileId, partNumber: partNumberParam } = await params;
  try {
    // Ensure RSA keys are initialized (for S3 config decryption)
    const { rsaKeyManager } = await import('@/lib/encryption/rsaKeyManager');
    if (!rsaKeyManager.publicKey) {
      await rsaKeyManager.init();
    }

    // Verify authentication OR valid share token
    const auth = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share_token');

    let isAuthorized = auth.authenticated;
    let authorizedUserId = auth.user?.id;

    if (!isAuthorized && shareToken) {
        const { sharedLinkRepository } = await import('@/lib/repositories/SharedLinkRepository');
        const sharedLink = await sharedLinkRepository.findByToken(shareToken);
        if (sharedLink && sharedLink.file_id === fileId) {
            // Check expiry
            if (!sharedLink.expires_at || new Date(sharedLink.expires_at) > new Date()) {
                isAuthorized = true;
                authorizedUserId = sharedLink.user_id; // Use owner's ID for Telegram access
            }
        }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partNumber = parseInt(partNumberParam, 10);

    // Validate parameters
    if (!fileId || isNaN(partNumber)) {
      return NextResponse.json(
        { error: 'Missing or invalid file_id or part number' },
        { status: 400 }
      );
    }

    // Get file metadata
    const file = await fileService.getFileById(fileId);
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
    const parts = await fileService.getFileParts(fileId);
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
    let telegramResponse;
    const errors = [];

    try {
      const dlUrl = await getFileDownloadUrl(authorizedUserId || file.user_id, part.telegram_file_id);
      telegramResponse = await fetch(dlUrl, { next: { revalidate: 0 } });

      if (!telegramResponse.ok) {
        throw new Error(`HTTP ${telegramResponse.status}`);
      }
    } catch (err) {
      console.warn(`[CHUNK] Failed to fetch part ${partNumber} from Telegram:`, err.message);
      errors.push(`Telegram: ${err.message}`);

      // Fallback to S3
      if (part.backup_storage_id) {
        console.log(`[CHUNK] Attempting S3 fallback for part ${partNumber} (Backup ID: ${part.backup_storage_id})`);
        try {
          // Dynamic import to avoid circular deps or server-only issues if any
          const { S3StorageProvider } = await import('@/lib/storage/S3StorageProvider');
          const { config } = await import('@/lib/config');
          // rsaKeyManager already initialized at top of handler

          const s3Provider = new S3StorageProvider();
          let s3Config = null;

          // Priority 1: Check if browser sent re-encrypted personal S3 config
          const s3ConfigHeader = request.headers.get('X-S3-Config');
          if (s3ConfigHeader) {
            try {
              const s3ConfigReencrypted = JSON.parse(s3ConfigHeader);
              // Decrypt with server's private key
              const decrypted = rsaKeyManager.decryptWithPrivate(s3ConfigReencrypted.encrypted_data);
              s3Config = JSON.parse(decrypted);
              console.log(`[CHUNK] Using personal S3 config from browser (bucket: ${s3Config.bucket})`);
            } catch (decryptErr) {
              console.warn(`[CHUNK] Failed to decrypt personal S3 config from header: ${decryptErr.message}`);
              s3Config = null;
            }
          }

          // Priority 2: Fall back to global S3 config
          if (!s3Config && config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey) {
            s3Config = {
              bucket: config.s3Bucket,
              accessKeyId: config.s3AccessKeyId,
              secretAccessKey: config.s3SecretAccessKey,
              region: config.s3Region || 'us-east-1',
              endpoint: config.s3Endpoint || null,
              storageClass: config.s3StorageClass || 'STANDARD'
            };
            console.log(`[CHUNK] Using global S3 config (bucket: ${s3Config.bucket})`);
          }

          if (s3Config) {
            const backupUrl = await s3Provider.getDownloadUrl(authorizedUserId || file.user_id, part.backup_storage_id, s3Config);
            const backupRes = await fetch(backupUrl);
            if (backupRes.ok) {
                console.log(`[CHUNK] S3 fallback successful for part ${partNumber}`);
                telegramResponse = backupRes; // Use backup response
            } else {
                throw new Error(`S3 HTTP ${backupRes.status}`);
            }
          } else {
             throw new Error('No S3 config available');
          }
        } catch (s3Err) {
          console.error(`[CHUNK] S3 fallback failed for part ${partNumber}:`, s3Err.message);
          errors.push(`S3: ${s3Err.message}`);
        }
      }
    }

    if (!telegramResponse || !telegramResponse.ok) {
       throw new Error(`Failed to fetch chunk. Errors: ${errors.join(', ')}`);
    }

    const encryptedBuffer = Buffer.from(await telegramResponse.arrayBuffer());

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
