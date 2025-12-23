import { NextResponse } from 'next/server';
import { sharedLinkRepository } from '@/lib/repositories/SharedLinkRepository';
import { fileRepository } from '@/lib/repositories/FileRepository';

export async function GET(request, { params }) {
  const { token } = await params;
  try {

    // 1. Find shared link
    const sharedLink = await sharedLinkRepository.findByToken(token);
    if (!sharedLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    // 2. Check expiry
    if (sharedLink.expires_at && new Date(sharedLink.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Link has expired' }, { status: 410 });
    }

    // 3. Increment views
    await sharedLinkRepository.incrementViews(sharedLink.id);

    // 4. Return metadata
    return NextResponse.json({
      success: true,
      file: {
        id: sharedLink.file.id,
        original_filename: sharedLink.file.original_filename,
        file_size: Number(sharedLink.file.file_size),
        mime_type: sharedLink.file.mime_type,
        is_encrypted: true,
        encryption_version: sharedLink.file.encryption_version || 2
      },
      isPasswordProtected: sharedLink.is_password_protected,
      wrappedKey: sharedLink.wrapped_file_key,
      keyIv: sharedLink.key_iv,
      parts: sharedLink.file.parts?.sort((a,b) => a.part_number - b.part_number).map(p => ({
        part_number: p.part_number,
        size: Number(p.size),
        iv: p.iv,
        auth_tag: p.auth_tag
      })) || []
    });

  } catch (err) {
    console.error('Fetch shared link error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Verification route for password protected links
 */
export async function POST(request, { params }) {
  const { token } = await params;
  try {
    const { passwordHash } = await request.json();

    const sharedLink = await sharedLinkRepository.findByToken(token);
    if (!sharedLink) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    if (!sharedLink.is_password_protected) {
      return NextResponse.json({ success: true });
    }

    if (sharedLink.password_hash === passwordHash) {
      return NextResponse.json({
        success: true,
        file: {
          id: sharedLink.file.id,
          original_filename: sharedLink.file.original_filename,
          file_size: Number(sharedLink.file.file_size),
          mime_type: sharedLink.file.mime_type,
          is_encrypted: true,
          encryption_version: sharedLink.file.encryption_version || 2
        },
        wrappedKey: sharedLink.wrapped_file_key,
        keyIv: sharedLink.key_iv,
        parts: sharedLink.file.parts?.sort((a,b) => a.part_number - b.part_number).map(p => ({
            part_number: p.part_number,
            size: Number(p.size),
            iv: p.iv,
            auth_tag: p.auth_tag
        })) || []
      });
    } else {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

  } catch (err) {
    console.error('Verify shared link password error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
