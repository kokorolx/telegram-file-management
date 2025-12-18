import { NextRequest, NextResponse } from 'next/server';
import { getFileById, moveFile, updateFolderStats, getFolderStats, getFolderById, moveFolder } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

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
      const targetFolder = await getFolderById(targetFolderId);
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
        const file = await getFileById(fId);
        if (!file) {
          errors.push({ id: fId, error: 'File not found' });
          continue;
        }

        if (file.user_id !== auth.user.id) {
          errors.push({ id: fId, error: 'Access denied' });
          continue;
        }

        const oldFolderId = file.folder_id;
        const newFolderId = targetFolderId || null;

        await moveFile(fId, newFolderId);

        // Update folder stats
        if (oldFolderId) {
          await updateFolderStats(oldFolderId, { files_count: -1, total_size: -(file.file_size || 0) });
        }
        if (newFolderId) {
          await updateFolderStats(newFolderId, { files_count: 1, total_size: file.file_size || 0 });
        }

        movedItems.push({ id: fId, type: 'file', folder_id: newFolderId });
      } catch (err) {
        errors.push({ id: fId, error: err.message });
      }
    }

    // Move folders
    for (const fId of foldersToMove) {
      try {
        const folder = await getFolderById(fId);
        if (!folder) {
          errors.push({ id: fId, error: 'Folder not found' });
          continue;
        }

        if (folder.user_id !== auth.user.id) {
          errors.push({ id: fId, error: 'Access denied' });
          continue;
        }

        const newParentId = targetFolderId || null;
        await moveFolder(fId, newParentId);

        movedItems.push({ id: fId, type: 'folder', parent_id: newParentId });
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
