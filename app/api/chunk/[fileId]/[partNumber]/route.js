import { NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';
import { getFileDownloadUrl } from '@/lib/telegram';
import { requireAuth } from '@/lib/auth';
import { storageProvider } from '@/lib/storage';

// export const dynamic = 'force-dynamic'; // Removed to allow caching

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

    const { searchParams } = new URL(request.url);
    const shareToken = searchParams.get('share_token');

    let isAuthorized = false;
    let authorizedUserId = null;

    // Priority 1: Check share token (doesn't trigger session/cookie logic)
    if (shareToken) {
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

    // Priority 2: Check session authentication if not authorized via token
    if (!isAuthorized) {
        const auth = await requireAuth(request);
        if (auth.authenticated) {
            isAuthorized = true;
            authorizedUserId = auth.user?.id;
        } else {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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

    // Fetch encrypted blob using storage provider abstraction
    const { config } = await import('@/lib/config');
    let encryptedBuffer;
    const errors = [];
    const userId = authorizedUserId || file.user_id;

    // Step 1: Try primary storage backend (Telegram, S3, or LOCAL)
    try {
      let storageId = part.telegram_file_id; // Default to Telegram ID for backward compat
      
      // For LOCAL storage, use the local storage ID format
      const { config: storageConfig } = await import('@/lib/config');
      
      // Special handling for LOCAL storage - read file directly instead of fetch
      if (storageConfig.storageBackend === 'LOCAL') {
        if (part.telegram_file_id?.startsWith('local:')) {
          storageId = part.telegram_file_id;
        }
        
        // Import LocalStorageProvider and read directly
          const { LocalStorageProvider } = await import('@/lib/storage/LocalStorageProvider');
          const localProvider = new LocalStorageProvider();
          encryptedBuffer = await localProvider.getFile(storageId);
          console.log(`[CHUNK] Retrieved from LOCAL: ${storageId} -> ${encryptedBuffer.length} bytes`);
      } else {
        // For other backends, fetch via URL
        const dlUrl = await storageProvider.getDownloadUrl(userId, storageId);
        const response = await fetch(dlUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${storageConfig.storageBackend}`);
        }

        encryptedBuffer = Buffer.from(await response.arrayBuffer());
      }
    } catch (err) {
      console.warn(`[CHUNK] Failed to fetch part ${partNumber} from primary storage:`, err.message);
      errors.push(`Primary Storage: ${err.message}`);

      // Step 2: Try backup storage (S3)
      if (part.backup_storage_id) {
        try {
          const { S3StorageProvider } = await import('@/lib/storage/S3StorageProvider');
          const s3Provider = new S3StorageProvider();
          let s3Config = null;

          // Priority 1: Check if browser sent re-encrypted personal S3 config
          const s3ConfigHeader = request.headers.get('X-S3-Config');
          if (s3ConfigHeader) {
            try {
              const s3ConfigReencrypted = JSON.parse(s3ConfigHeader);
              const decrypted = rsaKeyManager.decryptWithPrivate(s3ConfigReencrypted.encrypted_data);
              s3Config = JSON.parse(decrypted);
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
          }

          if (s3Config) {
            const backupUrl = await s3Provider.getDownloadUrl(userId, part.backup_storage_id, s3Config);
            const backupRes = await fetch(backupUrl);
            if (backupRes.ok) {
              encryptedBuffer = Buffer.from(await backupRes.arrayBuffer());
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

    if (!encryptedBuffer) {
      throw new Error(`Failed to fetch chunk. Errors: ${errors.join(', ')}`);
    }

    return new NextResponse(encryptedBuffer, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        'Content-Type': 'application/octet-stream',
        'Content-Length': encryptedBuffer.length.toString(),
        'X-Part-Number': part.part_number.toString(),
        'Vary': 'Accept-Encoding',
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
