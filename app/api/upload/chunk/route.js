import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { getFileById, createFile, createFilePart } from '@/lib/db';
import { sendFileToTelegram } from '@/lib/telegram';
import { getFileExtension, getMimeType } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/chunk
 * 
 * Receive encrypted file chunk from browser
 * Browser has already encrypted the chunk - server does NOT decrypt
 * 
 * Request body:
 * {
 *   "file_id": "uuid",
 *   "part_number": 1,
 *   "total_parts": 500,
 *   "encrypted_data": "base64-encoded-encrypted-bytes",
 *   "iv": "hex-encoded-iv",
 *   "auth_tag": "hex-encoded-auth-tag",
 *   "chunk_size": 2097152,
 *   "original_filename": "movie.mp4",
 *   "mime_type": "video/mp4",
 *   "folder_id": "optional-folder-id"
 * }
 * 
 * Response (success):
 * {
 *   "success": true,
 *   "file_id": "uuid",
 *   "part_number": 1,
 *   "total_parts": 500
 * }
 * 
 * Response (last chunk):
 * {
 *   "success": true,
 *   "file_id": "uuid",
 *   "part_number": 500,
 *   "total_parts": 500,
 *   "status": "completed",
 *   "file": { "id", "original_filename", "file_size", "is_encrypted" }
 * }
 */
export async function POST(request) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user ID from auth (required for file ownership)
    const userId = auth.user?.id;
    if (!userId) {
      console.error('[UPLOAD/CHUNK] User ID missing from auth');
      return NextResponse.json({ error: 'User identification failed' }, { status: 401 });
    }

    // Parse request
    const body = await request.json();

    const {
      file_id,
      part_number,
      total_parts,
      encrypted_data,
      iv,
      auth_tag,
      chunk_size,
      original_filename,
      mime_type,
      folder_id
    } = body;

    // Validate required fields
    if (
      !file_id ||
      !part_number ||
      !total_parts ||
      !encrypted_data ||
      !iv ||
      !auth_tag ||
      !original_filename
    ) {
      return NextResponse.json(
        {
          error: 'Missing required fields: file_id, part_number, total_parts, encrypted_data, iv, auth_tag, original_filename'
        },
        { status: 400 }
      );
    }

    // Validate IV and auth_tag format
    if (iv.length !== 24) {
      return NextResponse.json(
        { error: `Invalid IV length: ${iv.length} (expected 24 hex chars = 12 bytes)` },
        { status: 400 }
      );
    }

    if (auth_tag.length !== 32) {
      return NextResponse.json(
        { error: `Invalid auth tag length: ${auth_tag.length} (expected 32 hex chars = 16 bytes)` },
        { status: 400 }
      );
    }

    // Validate chunk size (encrypted data)
    const decryptedSize = parseInt(chunk_size, 10);
    if (!decryptedSize || decryptedSize <= 0 || decryptedSize > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: `Invalid chunk size: ${chunk_size} (must be > 0 and < 100MB)` },
        { status: 400 }
      );
    }

    // Step 1: Create file entry on first chunk
    let fileRecord = await getFileById(file_id);

    if (part_number === 1) {
      // First chunk - create file metadata
      const fileExt = getFileExtension(original_filename);
      const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';
      
      if (!userId) {
        console.error('[UPLOAD/CHUNK] Cannot create file without user_id');
        return NextResponse.json({ 
          error: 'User identification required. Please log in and try again.' 
        }, { status: 401 });
      }
      
      fileRecord = await createFile({
        id: file_id,
        user_id: userId,
        folder_id: folder_id || null,
        telegram_file_id: null,
        original_filename,
        file_size: decryptedSize * total_parts, // Approximate (will update when all chunks received)
        file_type: fileExt,
        mime_type: mimeType,
        is_encrypted: true,
        encryption_algo: 'AES-256-GCM'
      });

      console.log(`📁 Created encrypted file: ${file_id} (${original_filename}) for user ${userId}`);
    }

    if (!fileRecord) {
      return NextResponse.json(
        { error: 'Failed to create or retrieve file' },
        { status: 500 }
      );
    }

    // Step 2: Upload encrypted chunk to Telegram
    // We send it as-is (encrypted) to Telegram
    console.log(`📤 Uploading encrypted chunk ${part_number}/${total_parts}...`);

    let telegramFileId;
    try {
      // Convert base64 to Buffer
      const encryptedBuffer = Buffer.from(encrypted_data, 'base64');

      // Upload to Telegram (raw encrypted bytes)
      // sendFileToTelegram returns the file_id from Telegram Bot API
      telegramFileId = await sendFileToTelegram(encryptedBuffer, `${original_filename}_part_${part_number}`);

      console.log(`✓ Uploaded encrypted chunk ${part_number}/${total_parts}`);
    } catch (err) {
      console.error(`Failed to upload chunk ${part_number} to Telegram:`, err);
      return NextResponse.json(
        { error: `Failed to upload chunk: ${err.message}` },
        { status: 500 }
      );
    }

    // Step 3: Store chunk metadata in database
    // Key: We store IV and auth_tag (needed for decryption on browser)
    // We do NOT store encrypted_data in DB (only in Telegram)
    try {
      const partId = randomUUID();
      await createFilePart({
        id: partId,
        file_id,
        telegram_file_id: telegramFileId,
        part_number,
        size: decryptedSize, // Size of DECRYPTED chunk
        iv, // Hex string (needed for browser decryption)
        auth_tag // Hex string (needed for browser decryption)
      });

      console.log(`✓ Stored part metadata: ${part_number}/${total_parts}`);
    } catch (err) {
      console.error(`Failed to store part metadata:`, err);
      return NextResponse.json(
        { error: `Failed to store chunk metadata: ${err.message}` },
        { status: 500 }
      );
    }

    // Step 4: Check if all chunks received
    const isLastChunk = part_number === total_parts;

    if (isLastChunk) {
      // All chunks received - file is complete
      console.log(`✅ All ${total_parts} chunks received for file ${file_id}`);

      return NextResponse.json(
        {
          success: true,
          file_id,
          part_number,
          total_parts,
          status: 'completed',
          file: {
            id: fileRecord.id,
            original_filename: fileRecord.original_filename,
            file_size: decryptedSize * total_parts,
            is_encrypted: true
          }
        },
        { status: 201 } // 201 Created (file complete)
      );
    }

    // More chunks to come
    return NextResponse.json(
      {
        success: true,
        file_id,
        part_number,
        total_parts,
        status: 'uploading'
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Upload chunk error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to process chunk' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Validate that we have required database functions
 * (These should already exist in lib/db.js)
 */
async function validateDbFunctions() {
  const required = ['getFileById', 'createFile', 'createFilePart'];

  for (const fn of required) {
    if (typeof fn !== 'function') {
      throw new Error(`Missing database function: ${fn}`);
    }
  }
}
