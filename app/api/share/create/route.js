import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { sharedLinkRepository } from '@/lib/repositories/SharedLinkRepository';
import { fileRepository } from '@/lib/repositories/FileRepository';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user.id;
    const body = await request.json();
    const {
      fileId,
      wrappedKey,
      iv,
      isPasswordProtected,
      passwordHash,
      expiryMinutes
    } = body;

    // 1. Verify file exists and belongs to user
    const file = await fileRepository.findById(fileId);
    if (!file || file.user_id !== userId) {
      return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
    }

    // 2. Generate unique token
    const token = crypto.randomBytes(16).toString('hex');

    // 3. Calculate expiry
    let expiresAt = null;
    if (expiryMinutes && parseInt(expiryMinutes) > 0) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + parseInt(expiryMinutes));
    }

    // 4. Create Shared Link
    const sharedLink = await sharedLinkRepository.save({
      id: uuidv4(),
      file_id: fileId,
      user_id: userId,
      token,
      wrapped_file_key: wrappedKey,
      key_iv: iv,
      is_password_protected: isPasswordProtected || false,
      password_hash: passwordHash || null,
      expires_at: expiresAt
    });

    return NextResponse.json({
      success: true,
      token: sharedLink.token,
      link: `${process.env.NEXT_PUBLIC_APP_URL || ''}/share/${sharedLink.token}`
    }, { status: 201 });

  } catch (err) {
    console.error('Create share link error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
