import { NextRequest, NextResponse } from 'next/server';
import { fileRepository } from '@/lib/repositories/FileRepository';
import { folderRepository } from '@/lib/repositories/FolderRepository';
import { getUserFromRequest } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20; // 20 files per page
    const search = searchParams.get('search') || '';
    let folderId = searchParams.get('folder_id') || null;
    const usePath = searchParams.get('path');

    // Get authenticated user
    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    let currentFolder = null;

    // Resolve path if provided
    if (usePath) {
        if (usePath === '/') {
            folderId = null;
        } else {
            const folder = await folderRepository.findByPath(user.id, usePath);
            if (folder) {
                folderId = folder.id;
                currentFolder = folder;
            } else {
                // Path not found
                return NextResponse.json({ success: false, error: 'Folder not found' }, { status: 404 });
            }
        }
    } else if (folderId) {
        currentFolder = await folderRepository.findById(folderId);
        // Verify folder belongs to user
        if (currentFolder && currentFolder.user_id !== user.id) {
          return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }
    }

    let files;

    // If search is provided, we search in user's files only
    if (search.trim()) {
      const allFiles = await fileRepository.findByUserId(user.id);
      const searchLower = search.toLowerCase();
      files = allFiles.filter(
        (file) =>
          file.original_filename.toLowerCase().includes(searchLower) ||
          file.description?.toLowerCase().includes(searchLower) ||
          file.tags?.toLowerCase().includes(searchLower)
      );
    } else {
      // Fetch files for specific folder (or root if null) for current user
      files = await fileRepository.findByUserAndFolder(user.id, folderId);
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
