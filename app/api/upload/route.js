import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { insertFile } from '@/lib/db';
import { sendFileToTelegram } from '@/lib/telegram';
import { getFileExtension, getMimeType, validateFile } from '@/lib/utils';
import { processEncryptedUpload } from '@/lib/fileService';
import { validateMasterPassword } from '@/lib/authService';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const description = formData.get('description') || null;
    const tags = formData.get('tags') || null;
    const folderId = formData.get('folder_id') || null;
    const masterPassword = formData.get('master_password');

    // Validate file
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size and type
    const validation = validateFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Check encryption preference
    // User requested "Option 2": Use Master Password for encryption.

    if (masterPassword) {
       const isValid = await validateMasterPassword(masterPassword);
       if (!isValid) {
          return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 401 });
       }
       const result = await processEncryptedUpload(file, masterPassword, folderId, description, tags);
       return NextResponse.json({
         success: true,
         data: { id: result.fileId, name: file.name, is_encrypted: true }
       });
    } else {
        // Enforce password for secure upload
        return NextResponse.json({ success: false, error: 'Master password required for secure upload' }, { status: 400 });
    }

    // Legacy/Unencrypted Flow is disabled to enforce privacy preference
    /*
     Legacy code removed for clarity.
     If we need to restore unencrypted uploads, uncomment lines below or reverting commit.
    */
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
