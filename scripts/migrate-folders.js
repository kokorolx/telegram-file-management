import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  try {
    console.log('Starting migration...');

    // Check if folder_id column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'files' AND column_name = 'folder_id'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('Adding folder_id column to files table...');
      
      // Add folder_id column if it doesn't exist
      await pool.query(`
        ALTER TABLE files ADD COLUMN folder_id TEXT
      `);
      
      console.log('✓ Added folder_id column');
    } else {
      console.log('✓ folder_id column already exists');
    }

    // Check if folders table exists
    const checkFolders = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'folders'
    `);

    if (checkFolders.rows.length === 0) {
      console.log('Creating folders table...');
      
      await pool.query(`
        CREATE TABLE folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        )
      `);
      
      console.log('✓ Created folders table');
    } else {
      console.log('✓ Folders table already exists');
    }

    // Add foreign key constraint if it doesn't exist
    const checkFK = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'files' AND constraint_name = 'files_folder_id_fkey'
    `);

    if (checkFK.rows.length === 0) {
      console.log('Adding foreign key constraint...');
      
      await pool.query(`
        ALTER TABLE files 
        ADD CONSTRAINT files_folder_id_fkey 
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      `);
      
      console.log('✓ Added foreign key constraint');
    } else {
      console.log('✓ Foreign key constraint already exists');
    }

    console.log('✓ Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
