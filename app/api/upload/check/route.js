import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fileRepository } from '@/lib/repositories/FileRepository';
import { filePartRepository } from '@/lib/repositories/FilePartRepository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/check
 *
 * Check if file can be resumed
 * Query params: filename, size
 *
 * Response: {
 *   exists: boolean,
 *   file_id: string (if exists),
 *   uploaded_chunks: number[],
 *   missing_chunks: number[],
 *   total_chunks: number,
 *   can_resume: boolean
 * }
 */
export async function GET(request) {
  try {
    // Authenticate
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const size = parseInt(searchParams.get('size'), 10);

    // Validate params
    if (!filename || !size || isNaN(size)) {
      return NextResponse.json(
        { error: 'Missing or invalid filename or size' },
        { status: 400 }
      );
    }

    // Find existing incomplete upload
    const existingFile = await fileRepository.findByUserFilenameSize(
      userId,
      filename,
      size
    );

    if (!existingFile) {
      return NextResponse.json({
        exists: false,
        can_resume: false
      });
    }

    // Get uploaded parts
    const uploadedParts = await filePartRepository.getUploadedPartNumbers(
      existingFile.id
    );

    // Calculate missing chunks
    const totalChunks = existingFile.total_parts_expected || 0;

    if (totalChunks === 0) {
      // If total_parts not known yet, can't resume
      return NextResponse.json({
        exists: false,
        can_resume: false
      });
    }

    const uploadedSet = new Set(uploadedParts);
    const missingChunks = Array.from(
      { length: totalChunks },
      (_, i) => i + 1
    ).filter(num => !uploadedSet.has(num));

    const canResume = missingChunks.length > 0 && uploadedParts.length > 0;


    return NextResponse.json({
      exists: true,
      file_id: existingFile.id,
      uploaded_chunks: uploadedParts,
      missing_chunks: missingChunks,
      total_chunks: totalChunks,
      can_resume: canResume
    });

  } catch (err) {
    console.error('Resume check error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to check resume status' },
      { status: 500 }
    );
  }
}
