import { v4 as uuidv4 } from 'uuid';
import { deriveEncryptionKey, encryptBuffer } from './authService'; // Make sure this exists and exports correctly
import { sendFileToTelegram } from './telegram';
import { insertFile, insertFilePart } from './db';
import { getFileExtension, getMimeType } from './utils';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

// Chunk size configuration
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB for regular files
const MIN_VIDEO_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB minimum for videos
const MAX_VIDEO_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB maximum for videos

/**
 * Generate a random chunk size between min and max (inclusive)
 * Uses crypto.randomInt for better randomness
 */
function getRandomChunkSize(min = MIN_VIDEO_CHUNK_SIZE, max = MAX_VIDEO_CHUNK_SIZE) {
    // Generate random size between min and max
    const range = max - min;
    return min + crypto.randomInt(range + 1);
}

/**
 * Uploads a buffer with encryption and splitting using a provided key.
 * @param {Buffer} fileBuffer - File data as Buffer
 * @param {Buffer} key - Encryption key
 * @param {string} folderId
 * @param {string} filename - Original filename
 * @param {string} [description]
 * @param {string} [tags]
 * @param {string} [fileId] - Optional fileId (generated if not provided)
 */
export async function processEncryptedUploadWithKey(fileBuffer, key, folderId, filename, description, tags, fileId = null) {
    const id = fileId || uuidv4();
    console.log(`Starting encrypted upload (server key) for ${filename}, size: ${fileBuffer.length}, fileId: ${id}`);

    const fileExt = getFileExtension(filename);

    // Save Main File Record (First, to satisfy FK)
    await insertFile({
        id,
        folder_id: folderId,
        telegram_file_id: null,
        original_filename: filename,
        file_size: fileBuffer.length,
        file_type: fileExt,
        mime_type: getMimeType(fileExt),
        description: description,
        tags: tags,
        is_encrypted: true,
        encryption_algo: 'aes-256-gcm'
    });

    // Process Buffer (random chunk sizes for all files)
    await processBufferWithEncryption(fileBuffer, key, id);

    console.log(`Encrypted upload complete for ${filename}`);
    return { success: true, fileId: id };
}

/**
 * Derives key from password and uploads.
 * Optimizes videos with FFmpeg faststart before encryption.
 * @param {Buffer} fileBuffer - File data as Buffer
 * @param {string} masterPassword
 * @param {string} folderId
 * @param {string} filename
 * @param {string} [description]
 * @param {string} [tags]
 * @param {string} [fileId]
 */
export async function processEncryptedUpload(fileBuffer, masterPassword, folderId, description, tags, fileId, filename) {
    const startTime = Date.now();
    let optimizedBuffer = fileBuffer;

    console.log(`[FILE-SERVICE] ${fileId} - Starting encrypted upload process`);
    console.log(`[FILE-SERVICE] ${fileId} - File: ${filename}, Size: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`);

    // If video, optimize with FFmpeg faststart (reorder MOOV to beginning)
    if (filename.toLowerCase().endsWith('.mp4') || filename.toLowerCase().endsWith('.mov')) {
        console.log(`[FILE-SERVICE] ${fileId} - Detected video file, optimizing with FFmpeg...`);
        try {
            const optimizeStart = Date.now();
            optimizedBuffer = await optimizeVideoWithFaststart(fileBuffer, filename);
            const optimizeDuration = ((Date.now() - optimizeStart) / 1000).toFixed(1);
            const sizeSaved = ((fileBuffer.length - optimizedBuffer.length) / 1024).toFixed(2);
            console.log(`[FILE-SERVICE] ${fileId} - ✓ FFmpeg optimization complete (${optimizeDuration}s, saved ${sizeSaved}KB)`);
            console.log(`[FILE-SERVICE] ${fileId} - Original: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB → Optimized: ${(optimizedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
        } catch (err) {
            console.warn(`[FILE-SERVICE] ${fileId} - ⚠ FFmpeg optimization failed, using original:`, err.message);
            // Fall back to original buffer if optimization fails
        }
    }

    console.log(`[FILE-SERVICE] ${fileId} - Deriving encryption key from password...`);
    const key = await deriveEncryptionKey(masterPassword);
    console.log(`[FILE-SERVICE] ${fileId} - ✓ Key derived, starting encryption and chunking...`);

    // The instruction implies updating the buffer processing call.
    // The `processEncryptedUploadWithKey` function already handles the `processBufferWithEncryption` call internally.
    // No change is needed here based on the provided context and the current structure.
    return processEncryptedUploadWithKey(optimizedBuffer, key, folderId, filename, description, tags, fileId);
}

/**
 * Optimize video with FFmpeg faststart (reorder MOOV atom to beginning)
 * This allows video to start playing before full download
 * @param {Buffer} fileBuffer
 * @param {string} filename
 * @returns {Promise<Buffer>}
 */
async function optimizeVideoWithFaststart(fileBuffer, filename) {
    const tempDir = path.join('/tmp', `ffmpeg-${uuidv4()}`);
    const inputPath = path.join(tempDir, 'input.mp4');
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
        // Create temp directory
        await fs.mkdir(tempDir, { recursive: true });

        // Write input file
        await fs.writeFile(inputPath, fileBuffer);

        // Run FFmpeg with faststart flag (no re-encoding, just reordering atoms)
        execSync(
            `ffmpeg -i "${inputPath}" -c copy -movflags +faststart -y "${outputPath}"`,
            {
                stdio: 'pipe',
                timeout: 300000 // 5 minute timeout
            }
        );

        // Read optimized file
        const optimizedBuffer = await fs.readFile(outputPath);
        return optimizedBuffer;

    } catch (err) {
        console.error('FFmpeg faststart error:', err);
        throw err;
    } finally {
        // Cleanup temp files
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.warn('Failed to cleanup temp FFmpeg files:', cleanupErr);
        }
    }
}

/**
 * Process a buffer by splitting it into chunks and encrypting each chunk
 * @param {Buffer} fileBuffer - File data to process
 * @param {Buffer} key - Encryption key
 * @param {string} fileId - File ID for tracking
 */
async function processBufferWithEncryption(fileBuffer, key, fileId) {
     let partNumber = 1;
     const startTime = Date.now();
     const chunkSizes = [];

     // Pre-calculate chunk sizes
     let offset = 0;
     while (offset < fileBuffer.length) {
         // Use random size for all files
         const chunkSize = getRandomChunkSize();

         const actualSize = Math.min(chunkSize, fileBuffer.length - offset);
         chunkSizes.push(actualSize);
         offset += actualSize;
     }

     const totalChunks = chunkSizes.length;

     console.log(`[FILE-SERVICE] ${fileId} - 🎲 Random chunk sizing enabled (${MIN_VIDEO_CHUNK_SIZE/1024/1024}MB - ${MAX_VIDEO_CHUNK_SIZE/1024/1024}MB)`);
     console.log(`[FILE-SERVICE] ${fileId} - Chunk sizes: ${chunkSizes.map(s => (s/1024/1024).toFixed(2) + 'MB').join(', ')}`);

     console.log(`[FILE-SERVICE] ${fileId} - Starting buffer encryption (total chunks: ${totalChunks})`);

     try {
         // Process buffer with calculated chunk sizes
         offset = 0;
         for (let i = 0; i < totalChunks; i++) {
             const chunkSize = chunkSizes[i];
             const chunk = fileBuffer.subarray(offset, offset + chunkSize);
             offset += chunkSize;

             console.log(`[FILE-SERVICE] ${fileId} - Processing chunk ${partNumber}/${totalChunks} (${(chunk.length / 1024 / 1024).toFixed(2)}MB)...`);
             await processChunk(chunk, key, fileId, partNumber++);
         }

         const duration = ((Date.now() - startTime) / 1000).toFixed(1);
         console.log(`[FILE-SERVICE] ${fileId} - ✓ Buffer encryption complete (${duration}s, ${totalChunks} chunks)`);
         return { success: true, fileId };

     } catch (err) {
         console.error(`[FILE-SERVICE] ${fileId} - ✗ Buffer encryption failed:`, err.message);
         throw err;
     }
 }

// Keep legacy function for backward compatibility
async function processFileStream(file, key, fileId) {
    const stream = file.stream();
    const reader = stream.getReader();

    let buffer = Buffer.alloc(0);
    let partNumber = 1;

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // value is Uint8Array, convert to Buffer
            buffer = Buffer.concat([buffer, Buffer.from(value)]);

            while (buffer.length >= DEFAULT_CHUNK_SIZE) {
                const chunk = buffer.subarray(0, DEFAULT_CHUNK_SIZE);
                buffer = buffer.subarray(DEFAULT_CHUNK_SIZE);

                await processChunk(chunk, key, fileId, partNumber++);
            }
        }

        // Last chunk
        if (buffer.length > 0) {
            await processChunk(buffer, key, fileId, partNumber++);
        }

        return { success: true, fileId };

    } catch (err) {
        console.error('File stream encryption failed:', err);
        throw err;
    }
}

async function processChunk(chunkBuffer, key, fileId, partNumber) {
     if (chunkBuffer.length === 0) return;

     console.log(`[FILE-SERVICE] ${fileId} - Encrypting chunk ${partNumber}...`);

     // Encrypt
     const encryptStart = Date.now();
     const { encrypted, iv, authTag } = encryptBuffer(chunkBuffer, key);
     const encryptDuration = ((Date.now() - encryptStart) / 1000).toFixed(3);

     console.log(`[FILE-SERVICE] ${fileId} - ✓ Encrypted chunk ${partNumber} (${encryptDuration}s)`);
     console.log(`[FILE-SERVICE] ${fileId} - IV: ${iv.toString('hex').substring(0, 16)}..., AuthTag: ${authTag.toString('hex').substring(0, 16)}...`);

     // Upload
     const partFilename = `${fileId}_part_${partNumber}.enc`;
     console.log(`[FILE-SERVICE] ${fileId} - Uploading chunk ${partNumber} to Telegram as ${partFilename}...`);

     const uploadStart = Date.now();
     const tgFileId = await sendFileToTelegram(encrypted, partFilename);
     const uploadDuration = ((Date.now() - uploadStart) / 1000).toFixed(1);

     console.log(`[FILE-SERVICE] ${fileId} - ✓ Uploaded to Telegram (${uploadDuration}s), Telegram ID: ${tgFileId.substring(0, 20)}...`);

     // Save to DB
     console.log(`[FILE-SERVICE] ${fileId} - Saving chunk metadata to database...`);
     await insertFilePart({
         id: uuidv4(),
         file_id: fileId,
         telegram_file_id: tgFileId,
         part_number: partNumber,
         size: encrypted.length,
         iv: iv.toString('hex'),
         auth_tag: authTag.toString('hex')
     });

     console.log(`[FILE-SERVICE] ${fileId} - ✓ Chunk ${partNumber} complete`);
 }
