import { v4 as uuidv4 } from 'uuid';
import { deriveEncryptionKey, encryptBuffer } from './authService'; // Make sure this exists and exports correctly
import { sendFileToTelegram } from './telegram';
import { insertFile, insertFilePart } from './db';
import { getFileExtension, getMimeType } from './utils';

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Uploads a file with encryption and splitting.
 * @param {File} file - Web File object
 * @param {string} masterPassword
 * @param {string} folderId
 * @param {string} [description]
 * @param {string} [tags]
 */
export async function processEncryptedUpload(file, masterPassword, folderId, description, tags) {
    console.log(`Starting encrypted upload for ${file.name}, size: ${file.size}`);

    // 1. Derive Key
    const key = await deriveEncryptionKey(masterPassword);

    // 2. Prepare metadata
    const fileId = uuidv4();

    // 3. Process Stream
    const stream = file.stream();
    const reader = stream.getReader();

    let buffer = Buffer.alloc(0);
    let partNumber = 1;
    let totalSize = 0; // Uploaded size

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            // value is Uint8Array, convert to Buffer
            buffer = Buffer.concat([buffer, Buffer.from(value)]);

            while (buffer.length >= CHUNK_SIZE) {
                const chunk = buffer.subarray(0, CHUNK_SIZE);
                buffer = buffer.subarray(CHUNK_SIZE);

                await processChunk(chunk, key, fileId, partNumber++);
            }
        }

        // Last chunk
        if (buffer.length > 0) {
            await processChunk(buffer, key, fileId, partNumber++);
        }

        const fileExt = getFileExtension(file.name);

        // 4. Save Main File Record
        await insertFile({
            id: fileId,
            folder_id: folderId,
            telegram_file_id: null, // Encrypted files don't have a single ID
            original_filename: file.name,
            file_size: file.size, // Original size
            file_type: fileExt,
            mime_type: file.type || getMimeType(fileExt),
            description: description,
            tags: tags,
            is_encrypted: true,
            encryption_algo: 'aes-256-gcm'
        });

        console.log(`Encrypted upload complete for ${file.name}`);
        return { success: true, fileId };

    } catch (err) {
        console.error('Encrypted upload failed:', err);
        // Ideally we should rollback/delete parts here
        throw err;
    }
}

async function processChunk(chunkBuffer, key, fileId, partNumber) {
    if (chunkBuffer.length === 0) return;

    // Encrypt
    const { encrypted, iv, authTag } = encryptBuffer(chunkBuffer, key);

    // Upload
    // We need a unique filename for the part? e.g. "part_1.bin"
    const partFilename = `${fileId}_part_${partNumber}.enc`;
    const tgFileId = await sendFileToTelegram(encrypted, partFilename);

    // Save to DB
    await insertFilePart({
        id: uuidv4(),
        file_id: fileId,
        telegram_file_id: tgFileId,
        part_number: partNumber,
        size: encrypted.length,
        iv: iv.toString('hex'),
        auth_tag: authTag.toString('hex')
    });
}
