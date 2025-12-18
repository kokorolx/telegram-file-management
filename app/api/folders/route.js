import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createFolder, getFolders, getFoldersByParent, getAllFolders } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');
    const all = searchParams.get('all');
    const userFolders = searchParams.get('user_folders');

    // Get authenticated user
    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    let folders;
    if (userFolders === 'true') {
      // Return all folders for user (for move dialog)
      folders = await getAllFolders(user.id);
      return NextResponse.json({
        success: true,
        folders: folders,
      });
    } else if (all === 'true') {
      folders = await getAllFolders(user.id);
    } else if (parentId) {
      // Get subfolders for specific parent
      folders = await getFoldersByParent(user.id, parentId);
    } else {
      // Get root folders (parent_id is NULL) for current user
      folders = await getFolders(user.id);
    }

    return NextResponse.json({
      success: true,
      data: folders,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { name, parent_id } = await request.json();

    // Get authenticated user
    const user = getUserFromRequest(request);
    if (!user || !user.id) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'Folder name is required' },
        { status: 400 }
      );
    }

    // Validate folder name
    if (name.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Folder name too long (max 100 characters)' },
        { status: 400 }
      );
    }

    const folderId = uuidv4();
    const folder = await createFolder(folderId, user.id, name.trim(), parent_id);

    return NextResponse.json({
      success: true,
      data: folder,
    });
  } catch (error) {
    console.error('Folder creation error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
