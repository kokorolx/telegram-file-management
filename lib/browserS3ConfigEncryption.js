/**
 * Browser-side S3 Config Encryption
 * 
 * Flow:
 * 1. Decrypt S3 config using master password (master key)
 * 2. Re-encrypt using server's public key
 * 3. Send re-encrypted config to server (only for this upload)
 * 4. Server decrypts with private key and uses immediately
 */

/**
 * Fetch server's public key
 * @returns {Promise<string>} PEM public key
 */
export async function getServerPublicKey() {
  try {
    const res = await fetch('/api/encryption/public-key');
    if (!res.ok) throw new Error('Failed to fetch server public key');
    const data = await res.json();
    return data.public_key;
  } catch (err) {
    console.error('[S3 Config] Failed to fetch public key:', err);
    throw err;
  }
}

/**
 * Encrypt S3 config with server's public key using Web Crypto
 * @param {Object} s3Config - { bucket, accessKeyId, secretAccessKey, region, ... }
 * @param {string} publicKeyPEM - Server's public key in PEM format
 * @returns {Promise<Object>} { encrypted_data: base64 }
 */
export async function encryptS3ConfigWithServerKey(s3Config, publicKeyPEM) {
  try {
    // Convert PEM to CryptoKey
    const publicKey = await importPublicKey(publicKeyPEM);

    // Stringify config
    const plaintext = JSON.stringify(s3Config);
    const plaintextBuffer = new TextEncoder().encode(plaintext);

    // Encrypt with RSA-OAEP
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      publicKey,
      plaintextBuffer
    );

    // Return as base64
    return {
      encrypted_data: arrayBufferToBase64(encrypted)
    };
  } catch (err) {
    console.error('[S3 Config] Encryption error:', err);
    throw new Error(`Failed to encrypt S3 config: ${err.message}`);
  }
}

/**
 * Import PEM public key as CryptoKey
 * @param {string} pemKey - PEM format public key
 * @returns {Promise<CryptoKey>}
 */
async function importPublicKey(pemKey) {
  // Convert PEM to binary
  const binaryString = atob(
    pemKey
      .replace('-----BEGIN PUBLIC KEY-----', '')
      .replace('-----END PUBLIC KEY-----', '')
      .trim()
  );
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Import as CryptoKey
  return await crypto.subtle.importKey(
    'spki',
    bytes,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true, // extractable
    ['encrypt']
  );
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decrypt S3 config using master password (from browser encryption)
 * Uses same logic as S3ConfigService but in browser (Web Crypto API)
 * @param {Object} encryptedConfig - { encrypted_data, iv, auth_tag }
 * @param {string} masterPassword - Master password
 * @param {string} salt - Encryption salt
 * @returns {Promise<Object>} Decrypted S3 config
 */
export async function decryptS3ConfigWithMasterPassword(
  encryptedConfig,
  masterPassword,
  salt
) {
  try {
    const encoder = new TextEncoder();
    const KDF_ITERATIONS = 100000;
    const KDF_KEYLEN = 32;

    // Derive key using PBKDF2
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(masterPassword),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: encoder.encode(salt),
        iterations: KDF_ITERATIONS
      },
      passwordKey,
      KDF_KEYLEN * 8
    );

    const key = await crypto.subtle.importKey(
      'raw',
      derivedBits,
      'AES-GCM',
      false,
      ['decrypt']
    );

    // Convert hex strings to buffers
    const iv = hexToBuffer(encryptedConfig.iv);
    const authTag = hexToBuffer(encryptedConfig.auth_tag);
    const encryptedData = hexToBuffer(encryptedConfig.encrypted_data);

    // Combine encrypted data with auth tag
    const combined = new Uint8Array(encryptedData.length + authTag.length);
    combined.set(encryptedData);
    combined.set(authTag, encryptedData.length);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined
    );

    // Parse JSON
    const decoder = new TextDecoder();
    const json = decoder.decode(decrypted);
    return JSON.parse(json);
  } catch (err) {
    console.error('[S3 Config] Master password decryption error:', err);
    throw new Error(`Failed to decrypt S3 config: ${err.message}`);
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBuffer(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}
