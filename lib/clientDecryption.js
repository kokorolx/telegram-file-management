/**
 * Client-side decryption utilities using Web Crypto API
 * Works in browser only (not Node.js)
 * 
 * Implements AES-256-GCM decryption with PBKDF2 key derivation
 * Matches server-side implementation in authService.js
 */

const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const SALT = process.env.NEXT_PUBLIC_ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';

/**
 * Derive encryption key from password using PBKDF2
 * Must match server-side deriveEncryptionKey() behavior
 * 
 * @param {string} password - Master password
 * @returns {Promise<Uint8Array>} 32-byte encryption key
 */
export async function deriveEncryptionKeyBrowser(password) {
  if (!password) {
    throw new Error('Password required for key derivation');
  }

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
        salt: encoder.encode(SALT),
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
 * @param {number} partNumber - Part number to fetch
 * @param {Uint8Array} key - Derived encryption key
 * @returns {Promise<Uint8Array>} Decrypted chunk data
 */
export async function fetchAndDecryptChunk(fileId, partNumber, key) {
  try {
    // Fetch encrypted chunk metadata from server
    const chunkData = await fetchChunkMetadata(fileId, partNumber);

    const {
      encrypted_data,   // Base64-encoded encrypted blob
      iv,               // Hex-encoded IV
      auth_tag,         // Hex-encoded auth tag
      part_number,
      size
    } = chunkData;

    // Convert from Base64/Hex to Uint8Array
    const encryptedBuffer = base64ToUint8Array(encrypted_data);
    const ivBuffer = hexToUint8Array(iv);
    const authTagBuffer = hexToUint8Array(auth_tag);

    // Decrypt in browser
    const decrypted = await decryptChunkBrowser(
      encryptedBuffer,
      key,
      ivBuffer,
      authTagBuffer
    );

    console.log(`✓ Decrypted chunk ${part_number}/${size}`);
    return decrypted;
  } catch (err) {
    console.error(`Error fetching/decrypting chunk ${partNumber}:`, err);
    throw err;
  }
}

/**
 * Fetch entire encrypted file and decrypt in browser
 * Used for images, PDFs, documents that need the full file
 * 
 * @param {string} fileId - File ID
 * @param {Uint8Array} key - Derived encryption key
 * @param {Array<Object>} partMetadata - Array of { part_number, size }
 * @returns {Promise<Blob>} Decrypted file as blob
 */
export async function fetchAndDecryptFullFile(fileId, key, partMetadata) {
  if (!fileId || !key || !partMetadata || partMetadata.length === 0) {
    throw new Error('Missing parameters for full file decryption');
  }

  try {
    const chunks = [];

    // Decrypt each chunk and collect
    for (const part of partMetadata) {
      const decrypted = await fetchAndDecryptChunk(fileId, part.part_number, key);
      chunks.push(decrypted);
    }

    // Combine all chunks into single blob
    const blob = new Blob(chunks.map(c => c.buffer));
    console.log(`✓ Decrypted full file: ${blob.size} bytes from ${partMetadata.length} chunks`);
    return blob;
  } catch (err) {
    console.error('Error decrypting full file:', err);
    throw err;
  }
}

/**
 * Create a ReadableStream for encrypted file
 * Used for video/audio streaming - decrypts chunks on-demand
 * 
 * @param {string} fileId - File ID
 * @param {Uint8Array} key - Derived encryption key
 * @param {Array<Object>} partMetadata - Array of { part_number, size }
 * @returns {ReadableStream} Stream of decrypted data
 */
export function createDecryptedStream(fileId, key, partMetadata) {
  let currentPartIndex = 0;

  return new ReadableStream({
    async pull(controller) {
      try {
        if (currentPartIndex >= partMetadata.length) {
          controller.close();
          return;
        }

        const part = partMetadata[currentPartIndex];
        const decrypted = await fetchAndDecryptChunk(fileId, part.part_number, key);
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
export async function fetchFilePartMetadata(fileId) {
  try {
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/parts`);

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
