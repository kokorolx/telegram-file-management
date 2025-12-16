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

    // Check encryption
    if (masterPassword) {
       // Validate password
       const isValid = await validateMasterPassword(masterPassword);
       if (!isValid) {
          return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 401 });
       }

       // Process encrypted upload
       const result = await processEncryptedUpload(file, masterPassword, folderId, description, tags);

       return NextResponse.json({
         success: true,
         data: { id: result.fileId, name: file.name, is_encrypted: true }
       });
    }

    // Normal Upload Flow (Legacy/Unencrypted)
    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Send to Telegram
    let telegram_file_id;
    try {
      telegram_file_id = await sendFileToTelegram(buffer, file.name);
    } catch (error) {
      console.error('Telegram upload error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Extract file info
    const fileExt = getFileExtension(file.name);
    const fileMimeType = file.type || getMimeType(fileExt);

    // Create file record
    const fileData = {
      id: uuidv4(),
      folder_id: folderId,
      telegram_file_id,
      original_filename: file.name,
      file_size: file.size,
      file_type: fileExt,
      mime_type: fileMimeType,
      description,
      tags,
      is_encrypted: false
    };

    // Save to database
    try {
      await insertFile(fileData);
    } catch (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to save file metadata' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: fileData,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
