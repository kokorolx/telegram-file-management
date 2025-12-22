import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { userRepository } from './repositories/UserRepository.js';
import { v4 as uuidv4 } from 'uuid';

// Use PBKDF2 for key derivation
const KDF_ITERATIONS = 100000;
const KDF_KEYLEN = 32;
const KDF_DIGEST = 'sha256';

export class AuthService {
  /**
   * Registers a new user with username and password
   */
  async register(username, password, email = null) {
    // Check if user exists
    const existing = await userRepository.findByUsername(username);
    if (existing) {
      throw new Error('Username already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Create user
    const id = uuidv4();
    return await userRepository.save({
      id,
      username,
      email,
      password_hash: hash
    });
  }

  /**
   * Validates user credentials
   */
  async login(username, password) {
    const user = await userRepository.findByUsername(username);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    return { id: user.id, username: user.username };
  }

  /**
   * Validates the master password against the stored hash for a specific user.
   */
  async validateMasterPassword(password, userId) {
    if (!userId) return false;

    const user = await userRepository.findById(userId);
    if (!user || !user.master_password_hash) {
      return false;
    }
    return bcrypt.compare(password, user.master_password_hash);
  }

  /**
   * Sets new master password (hashes it and returns the hash)
   */
  async generateMasterPasswordHash(password) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  }

  /**
   * Verifies the regular login password for a user.
   * Useful for high-stakes security actions like resetting the master password.
   */
  async verifyLoginPassword(userId, password) {
    if (!userId) return false;
    const user = await userRepository.findById(userId);
    if (!user) return false;
    return bcrypt.compare(password, user.password_hash);
  }

  /**
   * Resets a user's master password using their login password for verification.
   * WARNING: This changes the encryption key.
   */
  async resetMasterPassword(userId, loginPassword, newMasterPassword) {
    // 1. Verify login password
    const isLoginValid = await this.verifyLoginPassword(userId, loginPassword);
    if (!isLoginValid) {
      throw new Error('Invalid login password');
    }

    // 2. Hash new master password
    const masterHash = await this.generateMasterPasswordHash(newMasterPassword);

    // 3. Keep existing encryption salt (critical for legacy file access)
    // If we rotate salt, old passwords won't work for old files
    const user = await userRepository.findById(userId);
    const encryptionSalt = user.encryption_salt;

    // 4. Update user record
    await userRepository.updateMasterPassword(userId, masterHash, encryptionSalt);

    return { success: true, encryptionSalt };
  }

  /**
   * Derives an encryption key from the master password.
   */
  async deriveEncryptionKey(password, userIdOrSalt = null) {
    let salt = userIdOrSalt;

    // If a userId is passed, fetch their specific salt from DB
    if (userIdOrSalt && userIdOrSalt.length > 20) {
      const user = await userRepository.findById(userIdOrSalt);
      salt = user?.encryption_salt;
    }

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
   */
  encryptBuffer(buffer, key) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv,
      authTag
    };
  }

  /**
   * Decrypts a buffer.
   */
  decryptBuffer(encryptedBuffer, key, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  }

  /**
   * Derives an encryption key from the server environment (Bot Token).
   */
  async deriveServerEncryptionKey() {
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

  /**
   * Encrypts sensitive system data
   */
  encryptSystemData(text) {
    if (!text) return null;

    const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.TELEGRAM_BOT_TOKEN || 'fallback-system-secret';
    const key = crypto.createHash('sha256').update(secret).digest();

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts sensitive system data
   */
  decryptSystemData(encryptedText) {
    if (!encryptedText || !encryptedText.includes(':')) return null;

    const [ivHex, authTagHex, encryptedData] = encryptedText.split(':');
    if (!ivHex || !authTagHex || !encryptedData) return null;

    const secret = process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.TELEGRAM_BOT_TOKEN || 'fallback-system-secret';
    const key = crypto.createHash('sha256').update(secret).digest();

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export const authService = new AuthService();

// Legacy compatibility exports
export const registerUser = (u, p) => authService.register(u, p);
export const loginUser = (u, p) => authService.login(u, p);
export const validateMasterPassword = (p, id) => authService.validateMasterPassword(p, id);
export const deriveEncryptionKey = (p, salt) => authService.deriveEncryptionKey(p, salt);
export const encryptBuffer = (b, k) => authService.encryptBuffer(b, k);
export const decryptBuffer = (e, k, i, a) => authService.decryptBuffer(e, k, i, a);
export const deriveServerEncryptionKey = () => authService.deriveServerEncryptionKey();
export const encryptSystemData = (t) => authService.encryptSystemData(t);
export const decryptSystemData = (e) => authService.decryptSystemData(e);
