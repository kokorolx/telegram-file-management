import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { insertFile } from '@/lib/db';
import { sendFileToTelegram } from '@/lib/telegram';
import { getFileExtension, getMimeType, validateFile } from '@/lib/utils';
import { processEncryptedUpload } from '@/lib/fileService';
import { validateMasterPassword } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';

/**
 * DEPRECATED: POST /api/upload
 *
 * This endpoint was used for server-side encryption.
 * We now always use browser-side encryption (via /api/upload/chunk)
 * for better security (zero-knowledge) and streaming support.
 */
export async function POST(request) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  console.warn(`[API/UPLOAD] ${requestId} - DEPRECATED: Server-side encryption request received. This flow is no longer supported.`);

  return NextResponse.json(
    {
      success: false,
      error: 'Server-side encryption is deprecated for security and performance reasons. Please use the modern browser-side encryption flow instead.'
    },
    { status: 410 } // 410 Gone
  );
}

/* Legacy implementation kept as reference
export async function POST_LEGACY(request) {
  try {
     // Get authenticated user
     const user = getUserFromRequest(request);
     if (!user || !user.id) {
       return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
     }

     const formData = await request.formData();
     const file = formData.get('file');
     const folderId = formData.get('folder_id') || null;
     const masterPassword = formData.get('master_password');
     const customFilename = formData.get('filename') || null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    if (masterPassword) {
       const isValid = await validateMasterPassword(masterPassword, user.id);
       if (!isValid) {
          return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 401 });
       }

       const fileBuffer = Buffer.from(await file.arrayBuffer());
       const finalFilename = customFilename || file.name;
       const fileId = uuidv4();

       processEncryptedUpload(fileBuffer, masterPassword, user.id, folderId, null, null, fileId, finalFilename)
         .catch(err => console.error(`Background encryption failed:`, err.message));

       return NextResponse.json({
         success: true,
         data: { id: fileId, name: finalFilename, is_encrypted: true, status: 'encrypting' }
       });
    } else {
      return NextResponse.json({ success: false, error: 'Master password required' }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
*/
