/**
 * Migration: Backfill user_id for existing files and folders
 * 
 * This script:
 * 1. Creates a default admin user if no users exist
 * 2. Backfills NULL user_ids in files and folders
 * 3. Adds NOT NULL constraints if needed
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function migrate() {
  try {
    console.log('Starting user_id migration...\n');

    // 1. Check if users table exists and has any users
    console.log('1. Checking existing users...');
    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const userCount = usersResult.rows[0].count;
    console.log(`   Found ${userCount} existing users`);

    let adminUserId;

    if (userCount === 0) {
      // Create default admin user
      console.log('\n2. Creating default admin user...');
      adminUserId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);

      await pool.query(
        'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
        [adminUserId, 'admin', passwordHash]
      );
      console.log(`   ✓ Created admin user with ID: ${adminUserId}`);
      console.log('   ℹ  Default credentials: admin / admin123');
      console.log('   ⚠  Change password after first login!');
    } else {
      // Use the first user (typically the only one in single-user setup)
      console.log('\n2. Using first existing user for migration...');
      const userResult = await pool.query('SELECT id FROM users LIMIT 1');
      adminUserId = userResult.rows[0].id;
      console.log(`   ✓ Using user ID: ${adminUserId}`);
    }

    // 3. Check for files with NULL user_id
    console.log('\n3. Checking files with NULL user_id...');
    const filesResult = await pool.query('SELECT COUNT(*) as count FROM files WHERE user_id IS NULL');
    const filesCount = filesResult.rows[0].count;
    console.log(`   Found ${filesCount} files without user_id`);

    if (filesCount > 0) {
      console.log(`   Backfilling ${filesCount} files...`);
      await pool.query('UPDATE files SET user_id = $1 WHERE user_id IS NULL', [adminUserId]);
      console.log(`   ✓ Updated ${filesCount} files`);
    }

    // 4. Check for folders with NULL user_id
    console.log('\n4. Checking folders with NULL user_id...');
    const foldersResult = await pool.query('SELECT COUNT(*) as count FROM folders WHERE user_id IS NULL');
    const foldersCount = foldersResult.rows[0].count;
    console.log(`   Found ${foldersCount} folders without user_id`);

    if (foldersCount > 0) {
      console.log(`   Backfilling ${foldersCount} folders...`);
      await pool.query('UPDATE folders SET user_id = $1 WHERE user_id IS NULL', [adminUserId]);
      console.log(`   ✓ Updated ${foldersCount} folders`);
    }

    // 5. Add NOT NULL constraints if they don't exist
    console.log('\n5. Ensuring NOT NULL constraints...');
    
    try {
      await pool.query(`
        ALTER TABLE files ALTER COLUMN user_id SET NOT NULL
      `);
      console.log('   ✓ Added NOT NULL constraint to files.user_id');
    } catch (err) {
      if (err.code === '23502') {
        console.log('   ✗ Cannot add NOT NULL: Still have NULL values');
        throw err;
      } else if (err.message.includes('already')) {
        console.log('   ✓ files.user_id already has NOT NULL constraint');
      }
    }

    try {
      await pool.query(`
        ALTER TABLE folders ALTER COLUMN user_id SET NOT NULL
      `);
      console.log('   ✓ Added NOT NULL constraint to folders.user_id');
    } catch (err) {
      if (err.code === '23502') {
        console.log('   ✗ Cannot add NOT NULL: Still have NULL values');
        throw err;
      } else if (err.message.includes('already')) {
        console.log('   ✓ folders.user_id already has NOT NULL constraint');
      }
    }

    console.log('\n✅ Migration complete!\n');

    if (userCount === 0) {
      console.log('📝 Next steps:');
      console.log('   1. Login with: admin / admin123');
      console.log('   2. Change password immediately');
      console.log('   3. Create user accounts as needed\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nDetails:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
