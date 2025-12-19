import { NextResponse } from 'next/server';
import { folderService } from '@/lib/services/FolderService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/folders/[id]
 * Get folder details.
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const folder = await folderService.getFolderById(id);

    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: folder,
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/folders/[id]
 * Rename or move a folder.
 */
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const { name, parent_id } = await request.json();

    if ((!name || !name.trim()) && parent_id === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nothing to update' },
        { status: 400 }
      );
    }

    if (name && name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Folder name too long (max 100 characters)' },
        { status: 400 }
      );
    }

    // Rename
    if (name) {
       await folderService.renameFolder(id, name.trim());
    }

    // Move
    if (parent_id !== undefined) {
       await folderService.moveFolder(id, parent_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Folder updated successfully',
    });
  } catch (error) {
    console.error('Folder update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete a folder. Subfolders and files are moved to the parent folder.
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const success = await folderService.deleteFolder(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully (content moved to parent/root)',
    });
  } catch (error) {
    console.error('Folder delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
