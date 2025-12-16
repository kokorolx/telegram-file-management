import { NextRequest, NextResponse } from 'next/server';
import { getAllFiles, getFilesByFolder } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20; // 20 files per page
    const search = searchParams.get('search') || '';
    const folderId = searchParams.get('folder_id') || null;

    // Get files from folder or all files
    let files = folderId ? await getFilesByFolder(folderId) : await getAllFiles();

    // Filter by search term
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      files = files.filter(
        (file) =>
          file.original_filename.toLowerCase().includes(searchLower) ||
          file.description?.toLowerCase().includes(searchLower) ||
          file.tags?.toLowerCase().includes(searchLower)
      );
    }

    // Calculate pagination
    const total = files.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedFiles = files.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedFiles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch files' },
      { status: 500 }
    );
  }
}
