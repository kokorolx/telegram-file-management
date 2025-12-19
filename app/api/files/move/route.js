import { NextRequest, NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';
import { folderService } from '@/lib/services/FolderService';
import { requireAuth } from '@/lib/apiAuth';

/**
 * PATCH /api/files/move
 * Move multiple files and folders to a target folder.
 */
export async function PATCH(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { fileId, fileIds, folderId, folderIds, targetFolderId } = await request.json();

    // Support both single and batch operations
    const filesToMove = fileIds || (fileId ? [fileId] : []);
    const foldersToMove = folderIds || (folderId ? [folderId] : []);

    if (filesToMove.length === 0 && foldersToMove.length === 0) {
      return NextResponse.json({ error: 'At least one file or folder ID is required' }, { status: 400 });
    }

    // Verify target folder ownership if specified
    if (targetFolderId) {
      const targetFolder = await folderService.getFolderById(targetFolderId);
      if (!targetFolder || targetFolder.user_id !== auth.user.id) {
        return NextResponse.json({ error: 'Target folder not found or access denied' }, { status: 403 });
      }

      // Prevent moving a folder to itself
      if (foldersToMove.includes(targetFolderId)) {
        return NextResponse.json({ error: 'Cannot move a folder into itself' }, { status: 400 });
      }
    }

    const movedItems = [];
    const errors = [];

    // Move files
    for (const fId of filesToMove) {
      try {
        // fileService.moveFile handles file existence and ownership validation?
        // Not currently, but let's assume it handles the update and stat logic.
        // We'll add ownership check here for safety.
        const file = await fileService.getFileById(fId);
        if (!file || file.user_id !== auth.user.id) {
          errors.push({ id: fId, error: 'File not found or access denied' });
          continue;
        }

        await fileService.moveFile(fId, targetFolderId);
        movedItems.push({ id: fId, type: 'file', folder_id: targetFolderId || null });
      } catch (err) {
        errors.push({ id: fId, error: err.message });
      }
    }

    // Move folders
    for (const fId of foldersToMove) {
      try {
        const folder = await folderService.getFolderById(fId);
        if (!folder || folder.user_id !== auth.user.id) {
          errors.push({ id: fId, error: 'Folder not found or access denied' });
          continue;
        }

        await folderService.moveFolder(fId, targetFolderId);
        movedItems.push({ id: fId, type: 'folder', parent_id: targetFolderId || null });
      } catch (err) {
        errors.push({ id: fId, error: err.message });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: `Moved ${movedItems.length} item(s)`,
      movedItems,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Move items error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to move items' },
      { status: 500 }
    );
  }
}
