import { NextResponse } from 'next/server';
import { getFileById, incrementFileDownloads } from '@/lib/db';
import { requireAuth } from '@/lib/apiAuth';

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 401 });

    const { fileId } = params;

    // Verify file belongs to user
    const file = await getFileById(fileId);
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await incrementFileDownloads(fileId);

    return NextResponse.json({ success: true, message: 'Download tracked' });
  } catch (error) {
    console.error('Increment file downloads error:', error);
    return NextResponse.json({ error: 'Failed to track download' }, { status: 500 });
  }
}
