import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fileService } from '@/lib/fileService';
import { storageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/upload/chunk
 *
 * Receive encrypted file chunk from browser and persist via storage abstraction.
 */
export async function POST(request) {
  try {
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

    // Step 1: Upload encrypted chunk to selected storage provider
    let storageId;
    try {
      const encryptedBuffer = Buffer.from(encrypted_data, 'base64');
      storageId = await storageProvider.uploadChunk(userId, encryptedBuffer, `${original_filename}_part_${part_number}`);
    } catch (err) {
      console.error(`Failed to upload chunk ${part_number} to storage:`, err);
      return NextResponse.json({ error: `Storage upload failed: ${err.message}` }, { status: 500 });
    }

    // Step 2: Persist metadata and handle stats via FileService
    // Note: We still use 'telegram_file_id' in the payload for database compatibility
    const { fileRecord, isLastChunk } = await fileService.handleUploadChunk(userId, {
      ...body,
      telegram_file_id: storageId
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
      status: 'uploading'
    });

  } catch (err) {
    console.error('Upload chunk error:', err);
    return NextResponse.json({ error: err.message || 'Failed to process chunk' }, { status: 500 });
  }
}
