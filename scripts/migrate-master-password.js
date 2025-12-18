/**
 * Migration: Move global master password hash to user-specific record
 *
 * Usage: node scripts/migrate-master-password.js [username]
 * If no username provided, it will migrate to the first user found.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function migrate() {
  const targetUsername = process.argv[2];

  try {
    console.log('Starting Master Password migration...\n');

    // 1. Get the global master password hash
    console.log('1. Checking global settings...');
    const settingsResult = await pool.query('SELECT master_password_hash FROM settings WHERE id = 1');
    const globalHash = settingsResult.rows[0]?.master_password_hash;

    if (!globalHash) {
      console.log('   ℹ No global master password hash found in settings table. Nothing to migrate.');
      process.exit(0);
    }
    console.log('   ✓ Found global master password hash.');

    // 2. Identify the target user
    let user;
    if (targetUsername) {
      console.log(`2. Looking for user: ${targetUsername}...`);
      const userResult = await pool.query('SELECT id, username FROM users WHERE username = $1', [targetUsername]);
      user = userResult.rows[0];
    } else {
      console.log('2. No username provided, looking for first user...');
      const userResult = await pool.query('SELECT id, username FROM users ORDER BY created_at ASC LIMIT 1');
      user = userResult.rows[0];
    }

    if (!user) {
      console.error('   ✗ Target user not found. Please register a user first.');
      process.exit(1);
    }
    console.log(`   ✓ Target user identified: ${user.username} (ID: ${user.id})`);

    // 3. Check if user already has a master password
    const userCheck = await pool.query('SELECT master_password_hash FROM users WHERE id = $1', [user.id]);
    if (userCheck.rows[0]?.master_password_hash) {
      console.log(`   ⚠ User "${user.username}" already has a master password set. Use --force to overwrite if needed (not implemented).`);
      process.exit(0);
    }

    // 4. Perform the migration
    console.log(`\n3. Migrating hash to user "${user.username}"...`);
    await pool.query('UPDATE users SET master_password_hash = $1 WHERE id = $2', [globalHash, user.id]);
    console.log('   ✓ Hash updated in users table.');

    // 5. Clear the global hash
    console.log('4. Clearing global master password hash...');
    await pool.query('UPDATE settings SET master_password_hash = NULL WHERE id = 1');
    console.log('   ✓ Global hash cleared.');

    console.log('\n✅ Migration complete! Your vault should now be accessible by your user account.\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
