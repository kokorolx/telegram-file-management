/**
 * S3ConfigService handles encryption and decryption of S3 backup configurations.
 * Configurations are encrypted using the user's Master Password.
 */
import crypto from 'crypto';

const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const KDF_DIGEST = 'sha256';

export class S3ConfigService {
  /**
   * Encrypts an S3 configuration object using the master password.
   * @param {Object} config - Plain S3 config (endpoint, accessKey, secretKey, bucket, region, storageClass).
   * @param {string} masterPassword - User's master password.
   * @param {string} salt - User's encryption salt.
   * @returns {Promise<{encryptedData: string, iv: string, authTag: string}>}
   */
  async encryptConfig(config, masterPassword, salt) {
    const key = await this.deriveKey(masterPassword, salt);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const plaintext = JSON.stringify(config);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encryptedData: encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypts an S3 configuration using the master password.
   * @param {string} encryptedData - Encrypted config (hex).
   * @param {string} ivHex - IV (hex).
   * @param {string} authTagHex - Auth tag (hex).
   * @param {string} masterPassword - User's master password.
   * @param {string} salt - User's encryption salt.
   * @returns {Promise<Object>} Decrypted S3 config object.
   */
  async decryptConfig(encryptedData, ivHex, authTagHex, masterPassword, salt) {
    const key = await this.deriveKey(masterPassword, salt);
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * Derives an encryption key from the master password using PBKDF2.
   * @param {string} password
   * @param {string} salt
   * @returns {Promise<Buffer>}
   */
  deriveKey(password, salt) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, KDF_ITERATIONS, KDF_KEYLEN, KDF_DIGEST, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey);
      });
    });
  }
}

export const s3ConfigService = new S3ConfigService();
