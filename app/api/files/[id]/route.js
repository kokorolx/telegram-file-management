import { NextRequest, NextResponse } from 'next/server';
import { fileService } from '@/lib/fileService';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const file = await fileService.getFileById(id);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: file,
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch file' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { folder_id } = body;

    // Move file
    if (folder_id !== undefined) {
      // Check if file exists
      const file = await fileService.getFileById(id);
      if (!file) {
        return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
      }

      await fileService.moveFile(id, folder_id);

      return NextResponse.json({
        success: true,
        message: 'File moved successfully',
      });
    }

    return NextResponse.json(
      { success: false, error: 'No valid update fields provided' },
      { status: 400 }
    );
  } catch (error) {
    console.error('File update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  try {
    const file = await fileService.getFileById(id);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    await fileService.deleteFile(id);

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete file' },
      { status: 500 }
    );
  }
}
