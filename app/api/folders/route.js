import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createFolder, getFolders, getFoldersByParent } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parent_id');

    let folders;
    if (parentId) {
      // Get subfolders for specific parent
      folders = await getFoldersByParent(parentId);
    } else {
      // Get root folders (parent_id is NULL)
      folders = await getFolders();
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
    const folder = await createFolder(folderId, name.trim(), parent_id);

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
