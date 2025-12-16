import { NextResponse } from 'next/server';
import { getFolderById, renameFolder, deleteFolder, moveFolder } from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const { id } = params;

    // Get folder info
    const folder = await getFolderById(id);

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

    // Check folder exists
    const folder = await getFolderById(id);
    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    if (name) {
       await renameFolder(id, name.trim());
    }

    // Handle move
    if (parent_id !== undefined) {
       // Prevent moving folder into itself or its children ideally (not checking children for now due to complexity, but should at least check id!=parent_id)
       if (id === parent_id) {
          return NextResponse.json({ success: false, error: 'Cannot move folder into itself' }, { status: 400 });
       }
       await moveFolder(id, parent_id);
    }

    return NextResponse.json({
      success: true,
      message: 'Folder updated successfully',
    });
  } catch (error) {
    console.error('Folder rename error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to rename folder' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    // Check folder exists
    const folder = await getFolderById(id);
    if (!folder) {
      return NextResponse.json(
        { success: false, error: 'Folder not found' },
        { status: 404 }
      );
    }

    await deleteFolder(id);

    return NextResponse.json({
      success: true,
      message: 'Folder deleted successfully (files moved to root)',
    });
  } catch (error) {
    console.error('Folder delete error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete folder' },
      { status: 500 }
    );
  }
}
