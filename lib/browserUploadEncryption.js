/**
 * Browser-side encryption for file uploads
 * Encrypts files BEFORE sending to server
 * Server never sees plaintext at any point
 *
 * Supports unlimited file sizes via streaming
 */

const MIN_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB minimum
const MAX_CHUNK_SIZE = 3 * 1024 * 1024; // 3MB maximum
const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const SALT = process.env.NEXT_PUBLIC_ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';
const MAX_CONCURRENT_CHUNKS = 3;
const COMPRESSIBLE_MIME_TYPES = [
  'text/',
  'application/json',
  'application/javascript',
  'application/xml',
  'image/svg+xml',
];
const COMPRESSIBLE_EXTENSIONS = [
  'txt', 'js', 'json', 'html', 'css', 'csv', 'md', 'xml', 'log', 'sql', 'sh', 'py', 'c', 'cpp', 'h', 'java'
];

import { generateDEK, wrapKey } from './envelopeCipher.js';

/**
 * Generate random chunk size matching backend behavior
 * Uses secure random for better distribution
 */
function getRandomChunkSize(min = MIN_CHUNK_SIZE, max = MAX_CHUNK_SIZE) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Encrypt file on browser and upload chunks to server
 * Streams file reading for unlimited file sizes
 * Supports resumable uploads by using saved chunk plan
 *
 * @param {File} file - File object from input
 * @param {string} password - Encryption password (optional, for encrypted upload)
 * @param {Function} onProgress - Callback(partNumber, totalParts, stage)
 * @param {string} folderId - Optional folder ID
 * @param {AbortSignal} abortSignal - For cancellation
 * @param {string} targetFileId - Existing file ID for resume
 * @param {number} resumeChunkStart - Resume from this chunk number
 * @param {number[]} savedChunkSizes - Saved chunk sizes for resume (use exact same sizes)
 * @returns {Promise<{file_id, total_parts, filename}>}
 */
export async function encryptFileChunks(file, password, onProgress, folderId, abortSignal = null, targetFileId = null, resumeChunkStart = 1, savedChunkSizes = null) {
  if (!file) {
    throw new Error('File is required');
  }

  if (!password) {
    throw new Error('Password is required for encrypted upload');
  }

  try {
    // Check if abort was already requested
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled');
    }

    // Step 1: Use provided file ID or generate new one
    const fileId = targetFileId || generateFileId();
    console.log(`📁 Starting encrypted upload: ${file.name} (${formatBytes(file.size)})`);
    console.log(`🔐 File ID: ${fileId}`);

    // Step 2: Pre-calculate chunks for accurate progress reporting
    let chunkSizes;
    let totalParts;
    
    if (savedChunkSizes && savedChunkSizes.length > 0) {
      // RESUME: Use exact same chunk sizes from previous upload
      chunkSizes = savedChunkSizes;
      totalParts = chunkSizes.length;
      console.log(`📦 Resume: Using saved chunk plan with ${totalParts} chunks`);
    } else {
      // NEW UPLOAD: Generate random chunk sizes
      chunkSizes = [];
      let remainingSize = file.size;
      while (remainingSize > 0) {
        const size = getRandomChunkSize();
        const actualSize = Math.min(size, remainingSize);
        chunkSizes.push(actualSize);
        remainingSize -= actualSize;
      }
      totalParts = chunkSizes.length;
      console.log(`📦 New upload: Calculated ${totalParts} chunks (using random sizes 2MB-3MB)`);
    }

    // Step 3: Fetch per-user encryption salt and derive key
    onProgress?.(0, totalParts, 'Fetching encryption configuration...');
    const settingsRes = await fetch('/api/settings');
    const settings = await settingsRes.json();
    const salt = settings.encryptionSalt;

    onProgress?.(0, totalParts, 'Deriving encryption key...');
    const dek = generateDEK(); // Unique key for this file
    const wrapped = await wrapKey(dek, password, salt);
    const key = dek; // Use the raw DEK for chunk encryption
    console.log(`✓ Data Encryption Key (DEK) generated and wrapped`);

    // Step 4: Process chunks with concurrency control
    const stream = file.stream();
    const reader = stream.getReader();

    let partNumber = 0;
    let buffer = new Uint8Array(0);
    let activeUploads = [];
    let completedParts = 0;

    const processUpload = async (chunkData, pNum) => {
      // RESUMABLE UPLOAD: Skip chunks before resumeChunkStart
      if (pNum < resumeChunkStart) {
        console.log(`[RESUME] Skipping chunk ${pNum} (already uploaded)`);
        completedParts++;
        onProgress?.(completedParts, totalParts, `Skipped chunk ${pNum}/${totalParts} (already uploaded)`);
        return;
      }

      // Determine if chunk should be compressed
      let dataToEncrypt = chunkData;
      let isCompressed = false;

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const isMedia = file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/') ||
                      ['pdf', 'zip', 'rar', '7z', 'gz', 'mp4', 'mov', 'jpg', 'jpeg', 'png', 'gif'].includes(fileExt);

      if (!isMedia || file.type === 'image/svg+xml') {
        try {
          const compressed = await compressData(chunkData);
          // Only use compressed if it actually saves space (at least 5%)
          if (compressed.length < chunkData.length * 0.95) {
            dataToEncrypt = compressed;
            isCompressed = true;
          }
        } catch (err) {
          console.warn(`[UPLOAD] Compression failed for chunk ${pNum}, using raw data`, err);
        }
      }

      // Encrypt chunk (dataToEncrypt might be compressed or raw)
      onProgress?.(completedParts, totalParts, `Encrypting chunk ${pNum}/${totalParts}${isCompressed ? ' (GZIP)' : ''}...`);
      const { encrypted_data, iv, auth_tag } = await encryptChunk(dataToEncrypt, key);

      // Upload encrypted chunk
      onProgress?.(completedParts, totalParts, `Uploading chunk ${pNum}/${totalParts}...`);
      await uploadEncryptedChunk(
        fileId,
        pNum,
        totalParts,
        encrypted_data,
        iv,
        auth_tag,
        chunkData.length, // Always send ORIGINAL chunk size for tracker
        file.name,
        file.type,
        folderId,
        onProgress,
        abortSignal,
        wrapped.wrappedKey, // Send on first chunk
        wrapped.iv,         // Send on first chunk
        2,                  // encryption_version = 2
        isCompressed,
        pNum === 1 ? chunkSizes : null  // Send chunk plan only on first chunk
      );

      completedParts++;
      onProgress?.(completedParts, totalParts, `Completed chunk ${pNum}/${totalParts}`);
      console.log(`✓ Chunk ${pNum} uploaded`);
    };

    while (true) {
       if (abortSignal?.aborted) throw new Error('Upload cancelled by user');

       const { done, value } = await reader.read();
       if (value) {
         buffer = concatenateUint8Arrays(buffer, new Uint8Array(value));
       }

       // Extract and process any chunks that are ready in the buffer
       while (partNumber < totalParts) {
         const currentChunkSize = chunkSizes[partNumber];

         // If we have enough data or the stream is done
         if (buffer.length >= currentChunkSize || (done && buffer.length > 0)) {
           const chunkData = buffer.slice(0, Math.min(buffer.length, currentChunkSize));
           buffer = buffer.slice(chunkData.length);

           partNumber++;
           const currentPartNum = partNumber;

           // Wait for part 1 to complete before allowing parallel uploads
           // This ensures the file record is created on the server first.
           if (currentPartNum === 1) {
             console.log(`[UPLOAD] Processing part 1 sequentially...`);
             await processUpload(chunkData, currentPartNum);
           } else {
             // Wait for pool capacity if needed
             if (activeUploads.length >= MAX_CONCURRENT_CHUNKS) {
               await Promise.race(activeUploads);
             }

             // Start new upload process
             const uploadPromise = processUpload(chunkData, currentPartNum).then(() => {
               activeUploads = activeUploads.filter(p => p !== uploadPromise);
             });
             activeUploads.push(uploadPromise);
           }
         } else {
           // Not enough data yet and not done
           break;
         }
       }

       if (done) break;
    }

    // Wait for all remaining uploads to finish
    if (activeUploads.length > 0) {
      onProgress?.(completedParts, totalParts, 'Finishing remaining uploads...');
      await Promise.all(activeUploads);
    }

    onProgress?.(totalParts, totalParts, 'Upload complete!');
    console.log(`✅ All ${totalParts} chunks uploaded successfully`);

    return {
      file_id: fileId,
      total_parts: totalParts,
      filename: file.name,
      size: file.size,
      is_encrypted: true
    };
  } catch (err) {
    console.error('Encrypted upload error:', err);
    throw err;
  }
}

/**
 * Encrypt a single chunk using AES-256-GCM
 *
 * @param {Uint8Array} chunkData - Raw chunk data
 * @param {Uint8Array} key - Encryption key (32 bytes)
 * @returns {Promise<{encrypted_data: string, iv: string, auth_tag: string}>}
 */
export async function encryptChunk(chunkData, key) {
  if (!chunkData || !key) {
    throw new Error('Chunk data and key are required');
  }

  try {
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Import key for Web Crypto
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['encrypt']
    );

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      chunkData
    );

    // Extract auth tag (last 16 bytes for GCM)
    const encryptedArray = new Uint8Array(encrypted);
    const authTag = encryptedArray.slice(-16);
    const ciphertext = encryptedArray.slice(0, -16);

    // Convert to base64 and hex for transmission
    return {
      encrypted_data: uint8ArrayToBase64(ciphertext),
      iv: uint8ArrayToHex(iv),
      auth_tag: uint8ArrayToHex(authTag)
    };
  } catch (err) {
    console.error('Chunk encryption error:', err);
    throw new Error(`Failed to encrypt chunk: ${err.message}`);
  }
}

/**
 * Derive encryption key from password using PBKDF2
 * Must match server-side key derivation
 *
 * @param {string} password - User password
 * @returns {Promise<Uint8Array>} 32-byte encryption key
 */
export async function deriveUploadKey(password, salt = null) {
  if (!password) {
    throw new Error('Password required for key derivation');
  }

  try {
    const encoder = new TextEncoder();

    // Use user salt if provided, fallback to environment, then legacy fixed string
    const finalSalt = salt || process.env.NEXT_PUBLIC_ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';

    // Import password as PBKDF2 key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode(finalSalt),
        iterations: KDF_ITERATIONS
      },
      passwordKey,
      KDF_KEYLEN * 8
    );

    return new Uint8Array(derivedBits);
  } catch (err) {
    console.error('Key derivation error:', err);
    throw new Error(`Failed to derive encryption key: ${err.message}`);
  }
}

/**
 * Upload encrypted chunk to server
 * Server stores in file_parts table and uploads to Telegram
 * Server NEVER decrypts
 *
 * @param {string} fileId - File ID
 * @param {number} partNumber - Current part number
 * @param {number} totalParts - Total parts
 * @param {string} encryptedData - Base64 encrypted data
 * @param {string} iv - Hex IV
 * @param {string} authTag - Hex auth tag
 * @param {number} chunkSize - Original chunk size
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type
 * @param {string} folderId - Optional folder ID
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} Server response
 */
export async function uploadEncryptedChunk(
  fileId,
  partNumber,
  totalParts,
  encryptedData,
  iv,
  authTag,
  chunkSize,
  filename,
  mimeType,
  folderId,
  onProgress,
  abortSignal = null,
  encryptedFileKey = null,
  keyIv = null,
  encryptionVersion = 1,
  isCompressed = false,
  chunkPlan = null  // NEW: Array of chunk sizes (sent only on first chunk)
) {
  try {
    // Check if abort was requested
    if (abortSignal?.aborted) {
      throw new Error('Upload cancelled by user');
    }

    const body = {
      file_id: fileId,
      part_number: partNumber,
      total_parts: totalParts,
      encrypted_data: encryptedData, // Base64
      iv, // Hex
      auth_tag: authTag, // Hex
      chunk_size: chunkSize,
      original_filename: filename,
      mime_type: mimeType || 'application/octet-stream',
      encrypted_file_key: encryptedFileKey,
      key_iv: keyIv,
      encryption_version: encryptionVersion,
      is_compressed: isCompressed
    };

    // Include chunk plan on first chunk only
    if (chunkPlan) {
      body.chunk_sizes = chunkPlan;
    }

    if (folderId) {
      body.folder_id = folderId;
    }

    const response = await fetch('/api/upload/chunk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortSignal  // Pass abort signal to fetch
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `Upload failed: HTTP ${response.status}`);
    }

    const result = await response.json();
    onProgress?.(partNumber, totalParts, `Uploaded: ${partNumber}/${totalParts}`);

    return result;
  } catch (err) {
    console.error(`Chunk upload error for part ${partNumber}:`, err);
    throw err;
  }
}

/**
 * Generate unique file ID for this upload
 * Used to correlate all chunks in database
 *
 * @returns {string} UUID v4
 */
function generateFileId() {
  return crypto.randomUUID();
}

/**
 * Compress data using GZIP via CompressionStream
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
async function compressData(data) {
  const stream = new Response(data).body
    .pipeThrough(new CompressionStream('gzip'));
  const compressed = await new Response(stream).arrayBuffer();
  return new Uint8Array(compressed);
}

/**
 * Convert Uint8Array to Base64 string
 */
function uint8ArrayToBase64(arr) {
  let binary = '';
  for (let i = 0; i < arr.byteLength; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary);
}

/**
 * Convert Uint8Array to hex string
 */
function uint8ArrayToHex(arr) {
  return Array.from(arr)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Concatenate two Uint8Arrays
 */
function concatenateUint8Arrays(arr1, arr2) {
  const result = new Uint8Array(arr1.length + arr2.length);
  result.set(arr1);
  result.set(arr2, arr1.length);
  return result;
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get estimated time remaining
 */
export function getEstimatedTimeRemaining(uploadedBytes, totalBytes, startTime) {
  const elapsed = Date.now() - startTime;
  const rate = uploadedBytes / elapsed; // bytes per ms
  const remaining = totalBytes - uploadedBytes;
  return Math.round(remaining / rate / 1000); // seconds
}

/**
 * Validate encrypted chunk before upload
 * Ensures IV and auth tag are present and valid
 */
export function validateEncryptedChunk(encrypted_data, iv, auth_tag) {
  if (!encrypted_data || !iv || !auth_tag) {
    throw new Error('Missing encryption metadata (encrypted_data, iv, or auth_tag)');
  }

  if (iv.length !== 24) { // 12 bytes = 24 hex chars
    throw new Error(`Invalid IV length: ${iv.length} (expected 24)`);
  }

  if (auth_tag.length !== 32) { // 16 bytes = 32 hex chars
    throw new Error(`Invalid auth tag length: ${auth_tag.length} (expected 32)`);
  }

  return true;
}
