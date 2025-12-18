import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { insertFile } from '@/lib/db';
import { sendFileToTelegram } from '@/lib/telegram';
import { getFileExtension, getMimeType, validateFile } from '@/lib/utils';
import { processEncryptedUpload } from '@/lib/fileService';
import { validateMasterPassword } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';

export async function POST(request) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[API/UPLOAD] ${requestId} - New upload request received`);
  
  try {
     // Get authenticated user
     const user = getUserFromRequest(request);
     console.log(`[API/UPLOAD] ${requestId} - User from request:`, user);
     if (!user || !user.id) {
       console.error(`[API/UPLOAD] ${requestId} - Not authenticated`);
       return NextResponse.json(
         { success: false, error: 'Authentication required' },
         { status: 401 }
       );
     }
     console.log(`[API/UPLOAD] ${requestId} - User ID: ${user.id}`);
  
     const formData = await request.formData();
     const file = formData.get('file');
     const description = formData.get('description') || null;
     const tags = formData.get('tags') || null;
     const folderId = formData.get('folder_id') || null;
     const masterPassword = formData.get('master_password');
     const customFilename = formData.get('filename') || null;

     console.log(`[API/UPLOAD] ${requestId} - File: ${file?.name}, Size: ${(file?.size / 1024 / 1024).toFixed(2)}MB`);
     console.log(`[API/UPLOAD] ${requestId} - Folder: ${folderId || 'root'}, Custom name: ${customFilename || 'none'}`);

    // Validate file
    if (!file) {
      console.error(`[API/UPLOAD] ${requestId} - No file provided`);
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size and type
    const validation = validateFile(file);
    if (!validation.valid) {
      console.error(`[API/UPLOAD] ${requestId} - Validation failed: ${validation.error}`);
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
    
    console.log(`[API/UPLOAD] ${requestId} - ✓ File validation passed`);

    // Check encryption preference
    // User requested "Option 2": Use Master Password for encryption.

    if (masterPassword) {
       console.log(`[API/UPLOAD] ${requestId} - Validating master password...`);
       const isValid = await validateMasterPassword(masterPassword);
       if (!isValid) {
          console.error(`[API/UPLOAD] ${requestId} - Invalid master password`);
          return NextResponse.json({ success: false, error: 'Invalid master password' }, { status: 401 });
       }
       
       console.log(`[API/UPLOAD] ${requestId} - ✓ Password valid`);
       console.log(`[API/UPLOAD] ${requestId} - Converting file to buffer...`);
       
       // Convert file stream to Buffer before returning response
       // (FormData stream is closed after response is sent)
       const fileBuffer = Buffer.from(await file.arrayBuffer());
       
       // Use custom filename if provided, otherwise use original
       const finalFilename = customFilename || file.name;
       
       // Start encryption in background (don't await)
       const fileId = uuidv4();
       console.log(`[API/UPLOAD] ${requestId} - Starting background processing (FFmpeg optimize + encrypt + chunk)...`);
       console.log(`[API/UPLOAD] ${requestId} - File ID: ${fileId}`);
       
       processEncryptedUpload(fileBuffer, masterPassword, user.id, folderId, description, tags, fileId, finalFilename)
         .then(() => {
           const duration = ((Date.now() - startTime) / 1000).toFixed(1);
           console.log(`[API/UPLOAD] ${requestId} - ✓ Processing complete in ${duration}s`);
         })
         .catch(err => {
           console.error(`[API/UPLOAD] ${requestId} - ✗ Background encryption failed:`, err.message);
         });
       
       return NextResponse.json({
         success: true,
         data: { 
           id: fileId, 
           name: finalFilename, 
           is_encrypted: true,
           status: 'encrypting'
         }
       });
    } else {
      // Master password required for all uploads
      console.error(`[API/UPLOAD] ${requestId} - Master password required`);
      return NextResponse.json({ success: false, error: 'Master password required' }, { status: 400 });
    }
  } catch (error) {
    console.error(`[API/UPLOAD] ${requestId} - ✗ UPLOAD FAILED:`, error.message);
    console.error(`[API/UPLOAD] ${requestId} - Stack:`, error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
  }
