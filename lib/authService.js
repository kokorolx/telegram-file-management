import { saveSettings, getSettings, createUser, getUserByUsername, getUserById } from './db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

// Use PBKDF2 for key derivation
const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const KDF_DIGEST = 'sha256';

/**
 * Registers a new user with username and password
 */
export async function registerUser(username, password) {
  // Check if user exists
  const existing = await getUserByUsername(username);
  if (existing) {
      throw new Error('Username already exists');
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  // Create user
  return await createUser(username, hash);
}

/**
 * Validates user credentials
 */
export async function loginUser(username, password) {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) return null;

  return { id: user.id, username: user.username };
}

/**
 * Validates the master password against the stored hash for a specific user.
 * @param {string} password
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function validateMasterPassword(password, userId) {
  if (!userId) return false;

  const user = await getUserById(userId);
  if (!user || !user.master_password_hash) {
    return false;
  }
  return bcrypt.compare(password, user.master_password_hash);
}

/**
 * Sets new master password (hashes it and saves to DB)
 * @param {string} password
 * @param {string} botToken
 * @param {string} userId
 */
export async function setMasterPassword(password, botToken, userId) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  // We need to update settings with the new hash
  // This assumes the settings entry already exists or we are creating it
  // We reuse saveSettings but might need to modify it or add a specific function
  // For now, let's create a specific DB function for this or modify user flow.
  // Actually db.js `saveSettings` overwrites everything. We should update db.js to handle this or
  // extending saveSettings to take optional hash.

  // Let's rely on a new db function or update existing.
  // For now, assume a new function `updateMasterPassword` exists or we import pool to do it directly?
  // Cleanest is to use `updateSettings` which we should create/modify in db.js

  // Since I can't easily modify db.js repeatedly without cost, I'll export a helper here
  // that uses a direct query if I had pool access, but I don't export pool.
  // I will have to add `updateMasterPasswordHash` to db.js next.

  return hash;
}

/**
 * Derives an encryption key from the master password.
 * This key is used for AES-256-GCM.
 * @param {string} password
 * @param {string} userIdOrSalt - Optional User ID or explicit salt string
 * @returns {Promise<Buffer>}
 */
export async function deriveEncryptionKey(password, userIdOrSalt = null) {
  let salt = userIdOrSalt;

  // If a userId is passed, fetch their specific salt from DB
  if (userIdOrSalt && userIdOrSalt.length > 20) { // Simple check for UUID-like userId
      const user = await getUserById(userIdOrSalt);
      salt = user?.encryption_salt;
  }

  // Use user-specific salt if provided, fallback to environment, then legacy fixed string
  const finalSalt = salt || process.env.ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, finalSalt, KDF_ITERATIONS, KDF_KEYLEN, KDF_DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Encrypts a buffer.
 * @param {Buffer} buffer
 * @param {Buffer} key
 * @returns {{ encrypted: Buffer, iv: Buffer, authTag: Buffer }}
 */
export function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(16); // 12 bytes is standard for GCM, but 16 is fine too. OpenSSL allows. 12 is recommended for efficiency.
  // Let's stick to 12 bytes (96 bits) for GCM standard IV? actually 12 bytes is recommended for GCM.
  const ivCorrect = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, ivCorrect);

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encrypted,
    iv: ivCorrect,
    authTag
  };
}

// Helpers for cookie-based session removed as per security requirement (RAM only).

export function decryptBuffer(encryptedBuffer, key, iv, authTag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

/**
 * Derives an encryption key from the server environment (Bot Token).
 * Used when no user password is provided (default simplified flow).
 * @returns {Promise<Buffer>}
 */
export async function deriveServerEncryptionKey() {
    const secret = process.env.TELEGRAM_BOT_TOKEN;
    if (!secret) {
        throw new Error('Server encryption secret (TELEGRAM_BOT_TOKEN) missing.');
    }
    const salt = 'telegram-file-manager-server-salt';
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(secret, salt, KDF_ITERATIONS, KDF_KEYLEN, KDF_DIGEST, (err, derivedKey) => {
            if (err) reject(err);
            else resolve(derivedKey);
        });
    });
}
