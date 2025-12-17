import { NextRequest, NextResponse } from 'next/server';
import { getAllFiles, getFilesByFolder, getFolderByPath, getFolderById } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20; // 20 files per page
    const search = searchParams.get('search') || '';
    let folderId = searchParams.get('folder_id') || null;
    const usePath = searchParams.get('path');

    let currentFolder = null;

    // Resolve path if provided
    if (usePath) {
        if (usePath === '/') {
            folderId = null;
        } else {
            const folder = await getFolderByPath(usePath);
            if (folder) {
                folderId = folder.id;
                currentFolder = folder;
            } else {
                // Path not found
                return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 });
            }
        }
    } else if (folderId) {
        currentFolder = await getFolderById(folderId);
    }

    let files;

    // If search is provided, we search globally (or we could restrict to folder, but global is usually better for "Search")
    // CURRENT BEHAVIOR: Global Search
    if (search.trim()) {
      const allFiles = await getAllFiles();
      const searchLower = search.toLowerCase();
      files = allFiles.filter(
        (file) =>
          file.original_filename.toLowerCase().includes(searchLower) ||
          file.description?.toLowerCase().includes(searchLower) ||
          file.tags?.toLowerCase().includes(searchLower)
      );
    } else {
      // Fetch files for specific folder (or root if null)
      files = await getFilesByFolder(folderId);
    }

    // Calculate pagination
    const total = files.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedFiles = files.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedFiles,
      metadata: {
        currentFolder: currentFolder ? {
            id: currentFolder.id,
            name: currentFolder.name,
            slug: currentFolder.slug,
            parent_id: currentFolder.parent_id
        } : null
      },
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
