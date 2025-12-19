/**
 * Client-side decryption utilities using Web Crypto API
 * Works in browser only (not Node.js)
 *
 * Implements AES-256-GCM decryption with PBKDF2 key derivation
 * Matches server-side implementation in authService.js
 */

const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const DEFAULT_SALT = 'telegram-file-manager-fixed-salt';

import { unwrapKey } from './envelopeCipher.js';

/**
 * Derive encryption key from password using PBKDF2
 * Must match server-side deriveEncryptionKey() behavior
 *
 * @param {string} password - Master password
 * @param {string} salt - User-specific encryption salt (hex or string)
 * @returns {Promise<Uint8Array>} 32-byte encryption key
 */
export async function deriveEncryptionKeyBrowser(password, salt) {
  if (!password) {
    throw new Error('Password required for key derivation');
  }

  const finalSalt = salt || DEFAULT_SALT;

  try {
    const encoder = new TextEncoder();

    // Import password as PBKDF2 key
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    // Derive key bits using PBKDF2 with SHA-256
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode(finalSalt),
        iterations: KDF_ITERATIONS
      },
      passwordKey,
      KDF_KEYLEN * 8 // Convert bytes to bits
    );

    return new Uint8Array(derivedBits);
  } catch (err) {
    console.error('Key derivation error:', err);
    throw new Error(`Failed to derive encryption key: ${err.message}`);
  }
}

/**
 * Decrypt a single chunk using AES-256-GCM
 *
 * @param {Uint8Array} encryptedBuffer - Encrypted data
 * @param {Uint8Array} key - 32-byte AES key
 * @param {Uint8Array} iv - 12-byte initialization vector
 * @param {Uint8Array} authTag - 16-byte authentication tag
 * @returns {Promise<Uint8Array>} Decrypted data
 */
export async function decryptChunkBrowser(encryptedBuffer, key, iv, authTag) {
  if (!encryptedBuffer || !key || !iv || !authTag) {
    throw new Error('Missing required parameters for decryption');
  }

  try {
    // Web Crypto requires auth tag appended to ciphertext
    const dataWithTag = new Uint8Array(encryptedBuffer.length + authTag.length);
    dataWithTag.set(encryptedBuffer);
    dataWithTag.set(authTag, encryptedBuffer.length);

    // Import the key as AES-GCM key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      dataWithTag
    );

    return new Uint8Array(decrypted);
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error(`Failed to decrypt chunk: ${err.message}`);
  }
}

/**
 * Fetch encrypted chunk metadata from server
 *
 * @param {string} fileId - File ID
 * @param {number} partNumber - Part number
 * @returns {Promise<Object>} Chunk metadata { encrypted_data, iv, auth_tag, ... }
 */
async function fetchChunkMetadata(fileId, partNumber) {
  try {
    const response = await fetch(
      `/api/chunk/${encodeURIComponent(fileId)}/${partNumber}`
    );

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error(`Error fetching chunk metadata for part ${partNumber}:`, err);
    throw err;
  }
}

/**
 * Fetch and decrypt a file chunk
 *
 * @param {string} fileId - File ID
 * @param {Object} partMetadata - Metadata for this part { part_number, iv, auth_tag, size }
 * @param {Uint8Array} key - Derived encryption key
 * @returns {Promise<Uint8Array>} Decrypted chunk data
 */
/**
 * Get the Data Encryption Key (DEK) for a file.
 * If version 2 (Envelope), unwrap the DEK using the Master Key.
 * If version 1 (Direct), the Master Key IS the DEK.
 */
export async function getDEK(file, masterKey, isDEK = false) {
  if (isDEK) {
    // masterKey is already the DEK (used in guest sharing)
    return masterKey instanceof Uint8Array ? masterKey : base64ToUint8Array(masterKey);
  }

  if (file.encryption_version === 2) {
    if (!file.encrypted_file_key || !file.key_iv) {
      throw new Error('Missing encryption metadata for version 2 file');
    }
    return await unwrapKey(file.encrypted_file_key, masterKey, DEFAULT_SALT, file.key_iv);
  }
  // Version 1 or fallback: Master Key is used directly
  return masterKey;
}

export async function fetchAndDecryptChunk(fileOrId, partMetadata, key, shareToken = null) {
  const fileId = typeof fileOrId === 'string' ? fileOrId : fileOrId.id;
  try {
    const {
      part_number,
      iv,               // Hex-encoded IV
      auth_tag,         // Hex-encoded auth tag
      size
    } = partMetadata;

    // Fetch RAW encrypted blob from server
    let url = `/api/chunk/${encodeURIComponent(fileId)}/${part_number}`;
    if (shareToken) {
      url += `?share_token=${encodeURIComponent(shareToken)}`;
    }
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch chunk ${part_number}: ${response.status}`);
    }

    const encryptedBuffer = new Uint8Array(await response.arrayBuffer());

    // Convert from Hex to Uint8Array
    const ivBuffer = hexToUint8Array(iv);
    const authTagBuffer = hexToUint8Array(auth_tag);

    // Decrypt in browser
    const decrypted = await decryptChunkBrowser(
      encryptedBuffer,
      key,
      ivBuffer,
      authTagBuffer
    );

    console.log(`✓ Decrypted chunk ${part_number} (${decrypted.length} bytes)`);
    return decrypted;
  } catch (err) {
    console.error(`Error fetching/decrypting chunk:`, err);
    throw err;
  }
}

const CONCURRENCY_LIMIT = 3;

/**
 * Fetch entire encrypted file and decrypt in browser
 * Used for images, PDFs, documents that need the full file
 */
export async function fetchAndDecryptFullFile(file, masterKey, partMetadata, shareToken = null, isDEK = false) {
  if (!file || !masterKey || !partMetadata || partMetadata.length === 0) {
    throw new Error('Missing parameters for full file decryption');
  }

  try {
    const dek = await getDEK(file, masterKey, isDEK);
    const results = new Array(partMetadata.length);
    const queue = partMetadata.map((part, index) => ({ part, index }));

    // Worker function to process the queue
    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        const { part, index } = item;
        try {
          results[index] = await fetchAndDecryptChunk(file.id, part, dek, shareToken);
        } catch (err) {
          console.error(`Worker error on part ${part.part_number}:`, err);
          throw err; // Stop all if one fails
        }
      }
    }

    // Start workers
    const workers = [];
    const numWorkers = Math.min(CONCURRENCY_LIMIT, partMetadata.length);
    for (let i = 0; i < numWorkers; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    // Combine all chunks into single blob
    const blob = new Blob(results.map(c => c.buffer));
    console.log(`✓ Decrypted full file: ${blob.size} bytes from ${partMetadata.length} chunks`);
    return blob;
  } catch (err) {
    console.error('Error decrypting full file:', err);
    throw err;
  }
}

/**
 * Verify if a given key is correct for a specific file by trying to decrypt the first chunk.
 *
 * @param {Object} file
 * @param {Uint8Array} masterKey
 * @param {Array<Object>} partMetadata
 * @returns {Promise<boolean>}
 */
export async function verifyFileKey(file, masterKey, partMetadata, isDEK = false) {
  if (!file || !masterKey || !partMetadata || partMetadata.length === 0) {
    return false;
  }

  try {
    const dek = await getDEK(file, masterKey, isDEK);
    // Try to decrypt the FIRST chunk to verify the key
    const firstPart = partMetadata[0];
    await fetchAndDecryptChunk(file.id, firstPart, dek);
    return true;
  } catch (err) {
    console.warn(`Key verification failed for file ${file.id}:`, err.message);
    return false;
  }
}


/**
 * Create a ReadableStream for encrypted file
 * Used for video/audio streaming - decrypts chunks on-demand
 *
 * @param {Object} file
 * @param {Uint8Array} masterKey
 * @param {Array<Object>} partMetadata - Array of { part_number, size }
 * @returns {Promise<ReadableStream>} Stream of decrypted data
 */
export async function createDecryptedStream(file, masterKey, partMetadata, shareToken = null, isDEK = false) {
  const dek = await getDEK(file, masterKey, isDEK);
  let currentPartIndex = 0;

  return new ReadableStream({
    async pull(controller) {
      try {
        if (currentPartIndex >= partMetadata.length) {
          controller.close();
          return;
        }

        const part = partMetadata[currentPartIndex];
        const decrypted = await fetchAndDecryptChunk(file.id, part, dek, shareToken);
        controller.enqueue(decrypted);
        currentPartIndex++;

        console.log(`Streamed part ${part.part_number}/${partMetadata.length}`);
      } catch (err) {
        console.error('Stream decryption error:', err);
        controller.error(err);
      }
    },
    cancel() {
      console.log('Decrypted stream cancelled by client');
    }
  });
}

/**
 * Fetch unencrypted file parts metadata
 * Returns information about each chunk (part_number, size) without encryption keys
 *
 * @param {string} fileId - File ID
 * @returns {Promise<Array<Object>>} Array of { part_number, size }
 */
export async function fetchFilePartMetadata(fileId, shareToken = null) {
  try {
    let url = `/api/files/${encodeURIComponent(fileId)}/parts`;
    if (shareToken) {
      url += `?share_token=${encodeURIComponent(shareToken)}`;
    }
    const response = await fetch(url);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const { parts } = await response.json();
    return parts;
  } catch (err) {
    console.error('Error fetching file parts metadata:', err);
    throw err;
  }
}

/**
 * Helper: Convert Base64 string to Uint8Array
 */
function base64ToUint8Array(base64String) {
  try {
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.error('Base64 decode error:', err);
    throw new Error(`Invalid Base64 string: ${err.message}`);
  }
}

/**
 * Helper: Convert hex string to Uint8Array
 */
function hexToUint8Array(hexString) {
  if (!hexString) {
    throw new Error('Invalid hex string: input is empty or undefined');
  }
  try {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
      bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
    }
    return bytes;
  } catch (err) {
    console.error('Hex decode error:', err);
    throw new Error(`Invalid hex string: ${err.message}`);
  }
}

/**
 * Helper: Convert Uint8Array to Base64
 */
export function uint8ArrayToBase64(buffer) {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

/**
 * Helper: Convert Uint8Array to hex string
 */
export function uint8ArrayToHex(buffer) {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
