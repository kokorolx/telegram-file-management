/**
 * RSA Key Manager
 * Manages server's RSA key pair for S3 config encryption
 * Public key is sent to browser for re-encrypting S3 credentials
 * Private key stays on server for decrypting
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const KEY_DIR = process.env.KEY_STORAGE_PATH || './.keys';
const PUBLIC_KEY_FILE = path.join(KEY_DIR, 'rsa.pub');
const PRIVATE_KEY_FILE = path.join(KEY_DIR, 'rsa.key');

export class RSAKeyManager {
  constructor() {
    this.publicKey = null;
    this.privateKey = null;
  }

  /**
   * Initialize keys - load from disk or generate new ones
   */
  async init() {
    try {
      // Check if keys exist
      if (fs.existsSync(PUBLIC_KEY_FILE) && fs.existsSync(PRIVATE_KEY_FILE)) {
        this.publicKey = fs.readFileSync(PUBLIC_KEY_FILE, 'utf8');
        this.privateKey = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');
        console.log('[RSA] Keys loaded from disk');
        return;
      }

      // Generate new keys
      console.log('[RSA] Generating new RSA key pair...');
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 4096,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      this.publicKey = publicKey;
      this.privateKey = privateKey;

      // Save to disk
      this._ensureKeyDir();
      fs.writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
      fs.writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
      console.log('[RSA] New keys generated and saved');
    } catch (err) {
      console.error('[RSA] Key initialization error:', err);
      throw err;
    }
  }

  /**
   * Encrypt data with public key (for browser to use)
   * @param {string} plaintext - Data to encrypt
   * @returns {string} Base64 encrypted data
   */
  encryptWithPublic(plaintext) {
    try {
      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(plaintext)
      );
      return encrypted.toString('base64');
    } catch (err) {
      console.error('[RSA] Encryption error:', err);
      throw new Error(`RSA encryption failed: ${err.message}`);
    }
  }

  /**
   * Decrypt data with private key (server-side only)
   * @param {string} encryptedBase64 - Base64 encrypted data
   * @returns {string} Decrypted plaintext
   */
  decryptWithPrivate(encryptedBase64) {
    try {
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        Buffer.from(encryptedBase64, 'base64')
      );
      return decrypted.toString('utf8');
    } catch (err) {
      console.error('[RSA] Decryption error:', err);
      throw new Error(`RSA decryption failed: ${err.message}`);
    }
  }

  /**
   * Get public key for client
   * @returns {string} PEM public key
   */
  getPublicKey() {
    if (!this.publicKey) {
      throw new Error('RSA keys not initialized');
    }
    return this.publicKey;
  }

  /**
   * Ensure key directory exists
   */
  _ensureKeyDir() {
    if (!fs.existsSync(KEY_DIR)) {
      fs.mkdirSync(KEY_DIR, { recursive: true, mode: 0o700 });
    }
  }
}

export const rsaKeyManager = new RSAKeyManager();
