import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fileService } from '@/lib/fileService';
import { storageProvider } from '@/lib/storage';
import { S3StorageProvider } from '@/lib/storage/S3StorageProvider';
import { rsaKeyManager } from '@/lib/encryption/rsaKeyManager';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// In-memory cache for S3 configs per upload session
// Key: `${userId}:${fileId}`, Value: { s3Config, expiresAt }
const s3ConfigCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * POST /api/upload/chunk
 *
 * Receive encrypted file chunk from browser and persist via storage abstraction.
 * Supports dual-upload: Telegram (primary) + S3/R2 (backup).
 *
 * IMPORTANT: Files are already encrypted by the browser. The server NEVER decrypts.
 * The server just stores the encrypted bytes in both Telegram and S3.
 * Only the browser (with master password) can decrypt the files.
 */
export async function POST(request) {
  try {
    // Ensure RSA keys are initialized
    if (!rsaKeyManager.publicKey) {
      await rsaKeyManager.init();
    }

    // Authenticate
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'User identification failed' }, { status: 401 });
    }

    // Parse request
    const body = await request.json();
    const {
      file_id,
      part_number,
      total_parts,
      encrypted_data,
      original_filename,
      chunk_size,
    } = body;

    // Basic Validation
    if (!file_id || !part_number || !total_parts || !encrypted_data || !original_filename) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (body.is_fragmented) {
      console.log(`[API] Received is_fragmented=true for file ${file_id}, part ${part_number}`);
    }

    const encryptedBuffer = Buffer.from(encrypted_data, 'base64');
    const chunkFilename = `${original_filename}_part_${part_number}`;
    
    // Debug: Log chunk sizes
    console.log(`[UPLOAD] Part ${part_number}: base64 input ${encrypted_data.length} chars -> buffer ${encryptedBuffer.length} bytes`);

    // Step 1: Upload encrypted chunk to primary storage (Telegram, S3, or LOCAL)
    let storageId;
    try {
      storageId = await storageProvider.uploadChunk(userId, encryptedBuffer, chunkFilename);
    } catch (err) {
      console.error(`Failed to upload chunk ${part_number} to primary storage:`, err);
      return NextResponse.json({ error: `Storage upload failed: ${err.message}` }, { status: 500 });
    }

    // Step 2: Attempt S3 backup upload (non-blocking)
    let backupStorageId = null;
    let backupBackend = null;
    const cacheKey = `${userId}:${file_id}`;
    try {
      const s3Provider = new S3StorageProvider();
      let s3Config = null;
      let configSource = null;

      // Check cache first (for chunks 2+)
      const cached = s3ConfigCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        s3Config = cached.s3Config;
        configSource = cached.configSource;
      } else {
        // Priority 1: Personal S3 config (re-encrypted by browser with server's public key)
        const { s3_config_reencrypted } = body;
        if (s3_config_reencrypted) {
          try {
            // Decrypt with server's private key
            const decrypted = rsaKeyManager.decryptWithPrivate(s3_config_reencrypted.encrypted_data);
            s3Config = JSON.parse(decrypted);
            configSource = 'Personal';
          } catch (decryptErr) {
            console.warn(`[BACKUP] Failed to decrypt personal S3 config: ${decryptErr.message}`);
            s3Config = null;
          }
        }

        // Priority 2: Global S3 config (from environment variables)
        if (!s3Config && config.s3Bucket && config.s3AccessKeyId && config.s3SecretAccessKey) {
          s3Config = {
            bucket: config.s3Bucket,
            accessKeyId: config.s3AccessKeyId,
            secretAccessKey: config.s3SecretAccessKey,
            region: config.s3Region || 'us-east-1',
            endpoint: config.s3Endpoint || null,
            storageClass: config.s3StorageClass || 'STANDARD'
          };
          configSource = 'Global';
        }

        // Cache the config for remaining chunks
        if (s3Config) {
          s3ConfigCache.set(cacheKey, {
            s3Config,
            configSource,
            expiresAt: Date.now() + CACHE_TTL
          });
        }
      }

      if (s3Config) {
        backupStorageId = await s3Provider.uploadChunk(userId, encryptedBuffer, chunkFilename, s3Config, file_id);
        backupBackend = s3Config.endpoint?.includes('r2.cloudflarestorage.com') ? 'R2' : 'S3';
      } else {
      }
    } catch (backupErr) {
      // Non-blocking: Log warning but don't fail the upload
      console.warn(`[BACKUP] Failed to upload chunk ${part_number} to S3 backup:`, backupErr.message);
    }

    // Clean up cache after last chunk
    if (part_number === total_parts) {
      s3ConfigCache.delete(cacheKey);
    }

    // Step 3: Persist metadata and handle stats via FileService
    const { fileRecord, isLastChunk } = await fileService.handleUploadChunk(userId, {
      ...body,
      telegram_file_id: storageId,
      backup_storage_id: backupStorageId,
      backup_backend: backupBackend,
      is_init_segment: body.is_fragmented && part_number === 1,  // First chunk of fragmented video is init segment
    });

    if (isLastChunk) {
      return NextResponse.json({
        success: true,
        file_id,
        part_number,
        total_parts,
        status: 'completed',
        file: {
          id: fileRecord.id,
          original_filename: fileRecord.original_filename,
          file_size: parseInt(chunk_size, 10) * total_parts,
          is_encrypted: true
        }
      }, { status: 201 });
    }

    return NextResponse.json({
      success: true,
      file_id,
      part_number,
      total_parts,
      status: 'uploading',
      backup: backupStorageId ? true : false,
    });

  } catch (err) {
    console.error('Upload chunk error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process chunk' }, { status: 500 });
  }
}
