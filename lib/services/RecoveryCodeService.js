/**
 * RecoveryCodeService handles generation, validation, and management of recovery codes.
 * Recovery codes are one-time use tokens used to reset the master password.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db.js';

const RECOVERY_CODE_LENGTH = 16; // XXXX-XXXX-XXXX-XXXX
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_EXPIRY_DAYS = 365;
const BCRYPT_ROUNDS = 10;

export class RecoveryCodeService {
  /**
   * Generate recovery codes in format XXXX-XXXX-XXXX-XXXX
   * @param {number} count - Number of codes to generate (default: 10)
   * @returns {Promise<string[]>} Array of plaintext recovery codes
   */
  generateCodes(count = RECOVERY_CODE_COUNT) {
    const codes = [];
    
    for (let i = 0; i < count; i++) {
      // Generate 16 random bytes and convert to uppercase hex
      const randomBytes = crypto.randomBytes(8).toString('hex').toUpperCase();
      // Format as XXXX-XXXX-XXXX-XXXX
      const code = [
        randomBytes.substring(0, 4),
        randomBytes.substring(4, 8),
        randomBytes.substring(8, 12),
        randomBytes.substring(12, 16)
      ].join('-');
      codes.push(code);
    }
    
    return codes;
  }

  /**
   * Hash recovery codes using bcrypt
   * @param {string} code - Plain recovery code
   * @returns {Promise<string>} Hashed code
   */
  async hashCode(code) {
    return bcrypt.hash(code, BCRYPT_ROUNDS);
  }

  /**
   * Save recovery codes to database
   * @param {string} userId - User ID
   * @param {string[]} codeHashes - Array of hashed codes
   * @param {number} expiresInDays - Expiry duration in days (default: 365)
   * @returns {Promise<{success: boolean, codeCount: number}>}
   */
  async saveCodes(userId, codeHashes, expiresInDays = RECOVERY_CODE_EXPIRY_DAYS) {
    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
      
      // Insert all codes
      for (const codeHash of codeHashes) {
        const codeId = uuidv4();
        await pool.query(
          `INSERT INTO recovery_codes (id, user_id, code_hash, expires_at) 
           VALUES ($1, $2, $3, $4)`,
          [codeId, userId, codeHash, expiresAt]
        );
      }
      
      // Update user flags
      await pool.query(
        `UPDATE users 
         SET recovery_codes_enabled = TRUE, 
             last_master_password_change = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [userId]
      );
      
      return {
        success: true,
        codeCount: codeHashes.length,
        expiresAt
      };
    } catch (error) {
      console.error('[RecoveryCodeService] Error saving codes:', error);
      throw error;
    }
  }

  /**
   * Verify a recovery code for a user
   * @param {string} userId - User ID
   * @param {string} plainCode - Plain recovery code
   * @returns {Promise<{valid: boolean, codeRecord: Object|null}>}
   */
  async verifyRecoveryCode(userId, plainCode) {
    try {
      // Find unused, non-expired codes for this user
      const result = await pool.query(
        `SELECT id, code_hash, expires_at, used 
         FROM recovery_codes 
         WHERE user_id = $1 AND used = FALSE 
         ORDER BY created_at DESC`,
        [userId]
      );

      if (result.rows.length === 0) {
        return { valid: false, codeRecord: null, reason: 'no_codes_available' };
      }

      // Check expiration
      const now = new Date();
      const validCodes = result.rows.filter(row => !row.expires_at || new Date(row.expires_at) > now);
      
      if (validCodes.length === 0) {
        return { valid: false, codeRecord: null, reason: 'all_codes_expired' };
      }

      // Compare against each valid code
      for (const codeRecord of validCodes) {
        const isMatch = await bcrypt.compare(plainCode, codeRecord.code_hash);
        if (isMatch) {
          return { valid: true, codeRecord };
        }
      }

      return { valid: false, codeRecord: null, reason: 'invalid_code' };
    } catch (error) {
      console.error('[RecoveryCodeService] Error verifying code:', error);
      throw error;
    }
  }

  /**
   * Burn (mark as used) a recovery code
   * @param {string} codeId - Code ID to burn
   * @param {string} reason - Reason for burning (used, expired, revoked)
   * @returns {Promise<boolean>} Success
   */
  async burnCode(codeId, reason = 'used') {
    try {
      await pool.query(
        `UPDATE recovery_codes 
         SET used = TRUE, used_at = CURRENT_TIMESTAMP, burned_reason = $1 
         WHERE id = $2`,
        [reason, codeId]
      );
      return true;
    } catch (error) {
      console.error('[RecoveryCodeService] Error burning code:', error);
      throw error;
    }
  }

  /**
   * List user's recovery codes (hashed display format)
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of code records with masked display
   */
  async listUserCodes(userId) {
    try {
      const result = await pool.query(
        `SELECT id, used, used_at, created_at, expires_at, burned_reason 
         FROM recovery_codes 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        display: `XXXX-****-****-${row.id.substring(row.id.length - 4)}`,
        used: row.used,
        usedAt: row.used_at,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        burnedReason: row.burned_reason
      }));
    } catch (error) {
      console.error('[RecoveryCodeService] Error listing codes:', error);
      throw error;
    }
  }

  /**
   * Get recovery code status for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Status object
   */
  async getUserCodeStatus(userId) {
    try {
      // Get user recovery settings
      const userResult = await pool.query(
        `SELECT recovery_codes_enabled, recovery_codes_generated_on_first_setup, last_master_password_change 
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get codes info
      const codesResult = await pool.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN used = FALSE THEN 1 ELSE 0 END) as remaining,
          MAX(created_at) as generated_at,
          MAX(expires_at) as expires_at,
          SUM(CASE WHEN used = TRUE THEN 1 ELSE 0 END) as used_count
         FROM recovery_codes 
         WHERE user_id = $1`,
        [userId]
      );

      const codes = codesResult.rows[0];

      return {
        enabled: user.recovery_codes_enabled || false,
        generatedOnFirstSetup: user.recovery_codes_generated_on_first_setup || false,
        lastMasterPasswordChange: user.last_master_password_change,
        generatedAt: codes.generated_at,
        expiresAt: codes.expires_at,
        totalCodes: parseInt(codes.total) || 0,
        remainingCodes: parseInt(codes.remaining) || 0,
        usedCodes: parseInt(codes.used_count) || 0
      };
    } catch (error) {
      console.error('[RecoveryCodeService] Error getting code status:', error);
      throw error;
    }
  }

  /**
   * Revoke all unused codes for a user
   * @param {string} userId - User ID
   * @param {string} reason - Reason for revocation (default: 'revoked')
   * @returns {Promise<number>} Number of codes revoked
   */
  async revokeAllCodes(userId, reason = 'revoked') {
    try {
      const result = await pool.query(
        `UPDATE recovery_codes 
         SET used = TRUE, burned_reason = $1 
         WHERE user_id = $2 AND used = FALSE
         RETURNING id`,
        [reason, userId]
      );

      return result.rows.length;
    } catch (error) {
      console.error('[RecoveryCodeService] Error revoking codes:', error);
      throw error;
    }
  }

  /**
   * Clean up expired codes (run as cron job)
   * @returns {Promise<number>} Number of codes cleaned up
   */
  async cleanupExpiredCodes() {
    try {
      const result = await pool.query(
        `UPDATE recovery_codes 
         SET burned_reason = 'expired' 
         WHERE used = FALSE AND expires_at < CURRENT_TIMESTAMP AND burned_reason IS NULL
         RETURNING id`
      );

      const cleaned = result.rows.length;
      
      if (cleaned > 0) {
        console.log(`[RecoveryCodeService] Cleaned up ${cleaned} expired recovery codes`);
      }

      return cleaned;
    } catch (error) {
      console.error('[RecoveryCodeService] Error cleaning up expired codes:', error);
      throw error;
    }
  }

  /**
   * Update recovery_codes_generated_on_first_setup flag
   * @param {string} userId - User ID
   * @param {boolean} flag - Flag value
   * @returns {Promise<boolean>} Success
   */
  async setRecoveryCodesGeneratedOnFirstSetup(userId, flag) {
    try {
      await pool.query(
        `UPDATE users 
         SET recovery_codes_generated_on_first_setup = $1 
         WHERE id = $2`,
        [flag, userId]
      );
      return true;
    } catch (error) {
      console.error('[RecoveryCodeService] Error updating first setup flag:', error);
      throw error;
    }
  }
}

export const recoveryCodeService = new RecoveryCodeService();
