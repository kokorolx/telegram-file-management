import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fileRepository } from '@/lib/repositories/FileRepository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/chunk-plan
 *
 * Retrieve chunk size plan for a file to support resume
 * Query params: file_id
 *
 * Response: {
 *   file_id: string,
 *   chunk_sizes: number[],  // Array of chunk sizes in bytes
 *   total_parts: number,
 *   total_size: number
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
    const fileId = searchParams.get('file_id');

    // Validate params
    if (!fileId) {
      return NextResponse.json(
        { error: 'Missing file_id' },
        { status: 400 }
      );
    }

    // Get file and verify ownership
    const file = await fileRepository.findById(fileId);
    if (!file || file.user_id !== userId) {
      return NextResponse.json({ error: 'File not found or unauthorized' }, { status: 404 });
    }

    // Get chunk plan
    const chunkSizes = await fileRepository.getChunkPlan(fileId);
    if (!chunkSizes || chunkSizes.length === 0) {
      return NextResponse.json(
        { error: 'No chunk plan found for this file' },
        { status: 404 }
      );
    }


    return NextResponse.json({
      file_id: fileId,
      chunk_sizes: chunkSizes,
      total_parts: chunkSizes.length,
      total_size: chunkSizes.reduce((sum, size) => sum + size, 0)
    });

  } catch (err) {
    console.error('Chunk plan retrieval error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve chunk plan' },
      { status: 500 }
    );
  }
}
