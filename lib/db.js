// PostgreSQL Database Layer
import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const getSslConfig = () => {
  // For local development with localhost, disable SSL
  if (process.env.DATABASE_URL?.includes('localhost')) {
    return false;
  }
  // For production (Vercel, etc), use SSL with no cert validation
  return process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSslConfig(),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function initDb() {
  try {
    // Create folders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
      )
    `);

    // Create files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        folder_id TEXT,
        telegram_file_id TEXT, -- Nullable to support split files
        original_filename TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT,
        mime_type TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        tags TEXT,
        is_encrypted BOOLEAN DEFAULT false,
        encryption_algo TEXT,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      )
    `);

    // Create file_parts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_parts (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        telegram_file_id TEXT NOT NULL,
        part_number INTEGER NOT NULL,
        size INTEGER NOT NULL,
        iv TEXT,
        auth_tag TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // Create settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY DEFAULT 1,
        telegram_bot_token TEXT NOT NULL,
        telegram_user_id TEXT NOT NULL,
        master_password_hash TEXT,
        setup_complete BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add columns if they don't exist (migrations for existing db)
    try {
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false`);
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS encryption_algo TEXT`);
        await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS master_password_hash TEXT`);
    } catch (e) {
        console.log('Migration note: Columns might already exist or error in migration', e.message);
    }

    // Critical Fix: Ensure telegram_file_id is nullable (Run explicitly)
    try {
        await pool.query(`ALTER TABLE files ALTER COLUMN telegram_file_id DROP NOT NULL`);
    } catch (e) {
        // Ignore error if it fails (e.g. table doesn't exist yet, though initDb creates it above)
        console.log('Migration note: Could not drop NOT NULL constraint', e.message);
    }

    console.log('PostgreSQL database initialized');
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

export async function createUser(username, passwordHash) {
  try {
    const id = crypto.randomUUID();
    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)',
      [id, username, passwordHash]
    );
    return { id, username };
  } catch (err) {
    console.error('Create user error:', err);
    throw err;
  }
}

export async function getUserByUsername(username) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  } catch (err) {
    console.error('Get user error:', err);
    throw err;
  }
}

export async function saveSettings(botToken, userId) {
  try {
    // Check if settings exist
    const result = await pool.query('SELECT id FROM settings WHERE id = 1');

    if (result.rows.length > 0) {
      // Update existing
      await pool.query(
        'UPDATE settings SET telegram_bot_token = $1, telegram_user_id = $2, setup_complete = true, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [botToken, userId]
      );
    } else {
      // Insert new
      await pool.query(
        'INSERT INTO settings (id, telegram_bot_token, telegram_user_id, setup_complete) VALUES (1, $1, $2, true)',
        [botToken, userId]
      );
    }
    return { success: true };
  } catch (err) {
    console.error('Save settings error:', err);
    throw err;
  }
}

export async function getSettings() {
  try {
    const result = await pool.query('SELECT telegram_bot_token, telegram_user_id, setup_complete, master_password_hash FROM settings WHERE id = 1');
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get settings error:', err);
    throw err;
  }
}

export async function updateMasterPasswordHash(hash) {
  try {
    const result = await pool.query('SELECT id FROM settings WHERE id = 1');
    if (result.rows.length === 0) {
       // Should not happen if setup is running, but safe guard
       await pool.query('INSERT INTO settings (id, telegram_bot_token, telegram_user_id, master_password_hash) VALUES (1, \'\', \'\', $1)', [hash]);
    } else {
       await pool.query('UPDATE settings SET master_password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1', [hash]);
    }
    return true;
  } catch (err) {
    console.error('Update master password error:', err);
    throw err;
  }
}

export async function insertFilePart(partData) {
  const { id, file_id, telegram_file_id, part_number, size, iv, auth_tag } = partData;
  try {
    await pool.query(
      `INSERT INTO file_parts (id, file_id, telegram_file_id, part_number, size, iv, auth_tag)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, file_id, telegram_file_id, part_number, size, iv, auth_tag]
    );
    return partData;
  } catch (err) {
    console.error('Insert file part error:', err);
    throw err;
  }
}

export async function isSetupComplete() {
  try {
    const result = await pool.query('SELECT setup_complete FROM settings WHERE id = 1');
    return result.rows[0]?.setup_complete || false;
  } catch (err) {
    // If table doesn't exist or error, return false
    return false;
  }
}

export async function insertFile(fileData) {
  const {
    id,
    folder_id,
    telegram_file_id,
    original_filename,
    file_size,
    file_type,
    mime_type,
    description,
    tags,
    is_encrypted,
    encryption_algo
  } = fileData;

  try {
    await pool.query(
      `INSERT INTO files (
            id, folder_id, telegram_file_id, original_filename, file_size,
            file_type, mime_type, description, tags, is_encrypted, encryption_algo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        folder_id || null,
        telegram_file_id,
        original_filename,
        file_size,
        file_type,
        mime_type,
        description || null,
        tags || null,
        is_encrypted || false,
        encryption_algo || null
      ]
    );
    return fileData;
  } catch (err) {
    console.error('Insert file error:', err);
    throw err;
  }
}

// Folder functions
export async function createFolder(folderId, name, parentId = null) {
  try {
    await pool.query(
      `INSERT INTO folders (id, name, parent_id) VALUES ($1, $2, $3)`,
      [folderId, name, parentId]
    );
    return { id: folderId, name, parent_id: parentId };
  } catch (err) {
    console.error('Create folder error:', err);
    throw err;
  }
}

export async function getFolders(parentId = null) {
  try {
    const result = await pool.query(
      'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC'
    );
    return result.rows;
  } catch (err) {
    console.error('Get folders error:', err);
    throw err;
  }
}

export async function getFoldersByParent(parentId) {
  try {
    const result = await pool.query(
      'SELECT * FROM folders WHERE parent_id = $1 ORDER BY name ASC',
      [parentId]
    );
    return result.rows;
  } catch (err) {
    console.error('Get subfolders error:', err);
    throw err;
  }
}

export async function getFolderById(folderId) {
  try {
    const result = await pool.query(
      'SELECT * FROM folders WHERE id = $1',
      [folderId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Get folder error:', err);
    throw err;
  }
}

export async function renameFolder(folderId, newName) {
  try {
    await pool.query(
      'UPDATE folders SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newName, folderId]
    );
    return true;
  } catch (err) {
    console.error('Rename folder error:', err);
    throw err;
  }
}

export async function deleteFolder(folderId) {
  try {
    // Delete will cascade to files in this folder
    await pool.query(
      'DELETE FROM folders WHERE id = $1',
      [folderId]
    );
    return true;
  } catch (err) {
    console.error('Delete folder error:', err);
    throw err;
  }
}

export async function getAllFiles() {
  try {
    const result = await pool.query('SELECT * FROM files ORDER BY uploaded_at DESC');
    return result.rows;
  } catch (err) {
    console.error('Get all files error:', err);
    throw err;
  }
}

export async function getFilesByFolder(folderId) {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE folder_id = $1 ORDER BY uploaded_at DESC',
      [folderId]
    );
    return result.rows;
  } catch (err) {
    console.error('Get files by folder error:', err);
    throw err;
  }
}

export async function getFileById(id) {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Get file by ID error:', err);
    throw err;
  }
}

export async function moveFile(fileId, targetFolderId) {
  try {
    await pool.query(
      'UPDATE files SET folder_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [targetFolderId, fileId]
    );
    return true;
  } catch (err) {
    console.error('Move file error:', err);
    throw err;
  }
}

export async function moveFolder(folderId, targetParentId) {
  try {
    await pool.query(
      'UPDATE folders SET parent_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [targetParentId, folderId]
    );
    return true;
  } catch (err) {
    console.error('Move folder error:', err);
    throw err;
  }
}

export async function deleteFile(id) {
  try {
    await pool.query('DELETE FROM files WHERE id = $1', [id]);
    return true;
  } catch (err) {
    console.error('Delete file error:', err);
    throw err;
  }
}

export async function getFileParts(fileId) {
  try {
    const result = await pool.query('SELECT * FROM file_parts WHERE file_id = $1 ORDER BY part_number ASC', [fileId]);
    return result.rows;
  } catch (err) {
    console.error('Get file parts error:', err);
    throw err;
  }
}

export async function closeDb() {
  try {
    await pool.end();
  } catch (err) {
    console.error('Close database error:', err);
  }
}
