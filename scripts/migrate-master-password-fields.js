/**
 * Migration: Move master password association from global settings to all users
 *
 * This script:
 * 1. Ensures 'master_password_hash' and 'encryption_salt' columns exist in 'users' table
 * 2. Backfills 'master_password_hash' from global settings to ALL existing users
 * 3. Backfills 'encryption_salt' from environment to ALL existing users (critical for decryption)
 * 4. Clears 'master_password_hash' from global settings
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Starting Master Password Fields migration...\n');

    // 1. Ensure columns exist in users table
    console.log('1. Ensuring master password columns exist in users table...');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS master_password_hash TEXT');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_salt TEXT');
    console.log('   ✓ Columns added/verified.');

    // 2. Get global settings
    console.log('2. Fetching global master password from settings...');
    const settingsResult = await pool.query('SELECT master_password_hash FROM settings WHERE id = 1');
    const globalHash = settingsResult.rows[0]?.master_password_hash;
    const globalSalt = process.env.ENCRYPTION_SALT || 'telegram-file-manager-fixed-salt';

    if (!globalHash) {
      console.log('   ℹ No global master password hash found. Will only set default encryption salts.');
    } else {
      console.log('   ✓ Found global master password hash.');
    }

    // 3. Update all users
    console.log('3. Updating all existing users...');
    const usersResult = await pool.query('SELECT id, username FROM users');
    const users = usersResult.rows;
    console.log(`   Found ${users.length} users to update.`);

    for (const user of users) {
      // We only update if they don't have a hash already (to prevent overwriting if script is re-run)
      const userCheck = await pool.query('SELECT master_password_hash, encryption_salt FROM users WHERE id = $1', [user.id]);
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (!userCheck.rows[0]?.master_password_hash && globalHash) {
        updates.push(`master_password_hash = $${paramIndex++}`);
        values.push(globalHash);
      }

      if (!userCheck.rows[0]?.encryption_salt) {
          updates.push(`encryption_salt = $${paramIndex++}`);
          values.push(globalSalt); // Critical: Use legacy salt for existing users to keep decryption working
      }

      if (updates.length > 0) {
        values.push(user.id);
        await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
        console.log(`   ✓ Updated fields for user: ${user.username}`);
      } else {
        console.log(`   ℹ User ${user.username} already up to date.`);
      }
    }

    // 4. Clear global hash from settings if successful
    if (globalHash) {
      console.log('\n4. Clearing legacy global master password hash...');
      await pool.query('UPDATE settings SET master_password_hash = NULL WHERE id = 1');
      console.log('   ✓ Legacy hash cleared.');
    }

    console.log('\n✅ Migration complete! Your master password fields are now per-user.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
