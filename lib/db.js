// PostgreSQL Database Layer
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

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

// Helper to slugify string
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-')   // Replace multiple - with single -
    .replace(/^-+/, '')       // Trim - from start
    .replace(/-+$/, '');      // Trim - from end
}

export async function initDb() {
  try {
    // Create users table FIRST (other tables reference it)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        master_password_hash TEXT,
        encryption_salt TEXT,
        tg_bot_token TEXT,
        tg_user_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    // Create folders table (references users table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        slug TEXT,
        parent_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
        UNIQUE (user_id, parent_id, slug) -- Ensure unique slugs within a directory per user
      )
    `);

    // Create files table (references users and folders tables)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        folder_id TEXT,
        telegram_file_id TEXT, -- Nullable to support split files
        original_filename TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        file_type TEXT,
        mime_type TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        description TEXT,
        tags TEXT,
        is_encrypted BOOLEAN DEFAULT false,
        encryption_algo TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
      )
    `);

    // Create file_parts table (references files table)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_parts (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        telegram_file_id TEXT NOT NULL,
        part_number INTEGER NOT NULL,
        size BIGINT NOT NULL,
        iv TEXT,
        auth_tag TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
      )
    `);

    // Create sessions table for express-session
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid varchar NOT NULL COLLATE "default",
        sess json NOT NULL,
        expire timestamp(6) NOT NULL,
        PRIMARY KEY (sid)
      )
    `);

    // Create user_bots table (one user can have multiple bots)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_bots (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT,
        bot_token TEXT NOT NULL,
        tg_user_id TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        upload_counter INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create user_stats table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        total_files INTEGER DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        total_uploads INTEGER DEFAULT 0,
        total_downloads INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create folder_stats table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folder_stats (
        id TEXT PRIMARY KEY,
        folder_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        files_count INTEGER DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create file_stats table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS file_stats (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        download_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        last_downloaded_at TIMESTAMP,
        last_viewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create bot_usage_stats table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS bot_usage_stats (
        id TEXT PRIMARY KEY,
        bot_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        files_count INTEGER DEFAULT 0,
        total_size BIGINT DEFAULT 0,
        uploads_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bot_id) REFERENCES user_bots(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(bot_id, user_id)
      )
    `);

    // Create index on expire column for cleanup
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_session_expire ON session (expire)
    `);

    // Add columns if they don't exist (migrations for existing db)
    try {
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false`);
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS encryption_algo TEXT`);
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS master_password_hash TEXT`);

        // Timestamp standardization across all tables
        const tablesWithTimestamps = [
            'users', 'settings', 'folders', 'files', 'file_parts',
            'user_bots', 'user_stats', 'folder_stats', 'file_stats', 'bot_usage_stats'
        ];

        for (const table of tablesWithTimestamps) {
            // Add created_at if missing (some tables call it uploaded_at, but we add created_at for standard)
            if (table !== 'files') { // files uses uploaded_at
                await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
            }
            await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
        }

        // Slug migration
        await pool.query(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS slug TEXT`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS master_password_hash TEXT`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS encryption_salt TEXT`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_bot_token TEXT`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS tg_user_id TEXT`);

        // User ID migration - add columns if they don't exist
        await pool.query(`ALTER TABLE files ADD COLUMN IF NOT EXISTS user_id TEXT`);
        await pool.query(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS user_id TEXT`);

        // Bot tracking migration
        await pool.query(`ALTER TABLE file_parts ADD COLUMN IF NOT EXISTS bot_id TEXT`);
        await pool.query(`ALTER TABLE user_bots ADD COLUMN IF NOT EXISTS upload_counter INTEGER DEFAULT 0`);

        // Create indexes for user_id queries
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON files (user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders (user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_parts_bot_id ON file_parts(bot_id)`);

        // Create indexes for stats queries
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_folder_stats_folder_id ON folder_stats(folder_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_folder_stats_user_id ON folder_stats(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_stats_file_id ON file_stats(file_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_stats_user_id ON file_stats(user_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_bot_usage_stats_bot_id ON bot_usage_stats(bot_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_bot_usage_stats_user_id ON bot_usage_stats(user_id)`);
    } catch (e) {
        console.log('Migration note: Columns might already exist or error in migration', e.message);
    }

    // Create unique index for root folders (where parent_id is NULL)
    // Run this AFTER adding the column
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_root_slug ON folders (slug) WHERE parent_id IS NULL
    `);

    // Also ensure the unique constraint exists for non-root (if table existed before)
    // It's hard to conditionally add constraint in pure SQL easily without checking catalog,
    // but unique index suffices for functional requirement.
    // Let's add partial index for non-null parent too?
    // Or just rely on app logic + Unique Index if possible.
    // Actually, `UNIQUE (parent_id, slug)` is standard.
    // Let's add a unique index for (parent_id, slug) as well to be safe for existing tables
    await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS unique_folder_slug ON folders (parent_id, slug) WHERE parent_id IS NOT NULL
    `);

    // Backfill Slugs
    try {
        const foldersWithoutSlug = await pool.query("SELECT id, name, parent_id FROM folders WHERE slug IS NULL");
        for (const folder of foldersWithoutSlug.rows) {
            let baseSlug = slugify(folder.name);
            if (!baseSlug) baseSlug = 'folder';

            let finalSlug = baseSlug;
            let counter = 1;

            // Simple conflict resolution during migration
            while(true) {
                // Check collision
                const conflict = await pool.query(
                    "SELECT 1 FROM folders WHERE slug = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL)) AND id != $3",
                    [finalSlug, folder.parent_id, folder.id]
                );

                if (conflict.rows.length === 0) break;
                finalSlug = `${baseSlug}-${counter++}`;
            }

            await pool.query("UPDATE folders SET slug = $1 WHERE id = $2", [finalSlug, folder.id]);
        }
    } catch (e) {
        console.log('Migration note: Slug backfill error', e.message);
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

export async function getUserById(id) {
  try {
    const result = await pool.query('SELECT id, username, password_hash, master_password_hash, encryption_salt, created_at FROM users WHERE id = $1', [id]);
    return result.rows[0];
  } catch (err) {
    console.error('Get user by ID error:', err);
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

export async function saveUserSettings(userId, botToken, telegramUserId) {
  try {
    await pool.query(
      'UPDATE users SET tg_bot_token = $1, tg_user_id = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [botToken, telegramUserId, userId]
    );
    return { success: true };
  } catch (err) {
    console.error('Save user settings error:', err);
    throw err;
  }
}

// Bot Management Functions
export async function addBotToUser(userId, botData) {
  const { name, botToken, tgUserId } = botData;
  const id = crypto.randomUUID();
  try {
     await pool.query(
         'INSERT INTO user_bots (id, user_id, name, bot_token, tg_user_id) VALUES ($1, $2, $3, $4, $5)',
         [id, userId, name || 'My Bot', botToken, tgUserId]
     );
     return { id, name, botToken, tgUserId };
  } catch (err) {
      console.error('Add bot error:', err);
      throw err;
  }
}

export async function getUserBots(userId) {
  try {
     const result = await pool.query(
         'SELECT * FROM user_bots WHERE user_id = $1 ORDER BY created_at ASC',
         [userId]
     );
     return result.rows;
  } catch (err) {
      console.error('Get user bots error:', err);
      throw err;
  }
}

export async function deleteUserBot(userId, botId) {
    try {
        await pool.query(
            'DELETE FROM user_bots WHERE id = $1 AND user_id = $2',
            [botId, userId]
        );
        return true;
    } catch (err) {
        console.error('Delete user bot error:', err);
        throw err;
    }
}

export async function setDefaultBot(userId, botId) {
    try {
        // Unset previous default
        await pool.query('UPDATE user_bots SET is_default = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
        // Set new default
        await pool.query('UPDATE user_bots SET is_default = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2', [botId, userId]);
        return true;
    } catch (err) {
        console.error('Set default bot error:', err);
        throw err;
    }
}

export async function getUserSettings(userId) {
  try {
    // Return primary/default bot or the first one found
    const result = await pool.query(
      'SELECT bot_token as tg_bot_token, tg_user_id FROM user_bots WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC LIMIT 1',
      [userId]
    );

    if (result.rows.length > 0) {
        return result.rows[0];
    }

    // Fallback to legacy user columns if they have data (migration support)
    const legacy = await pool.query(
      'SELECT tg_bot_token, tg_user_id FROM users WHERE id = $1',
      [userId]
    );
    return legacy.rows[0];
  } catch (err) {
    console.error('Get user settings error:', err);
    throw err;
  }
}

export async function updateUserMasterPasswordHash(userId, hash, salt = null) {
  try {
    if (salt) {
      await pool.query('UPDATE users SET master_password_hash = $1, encryption_salt = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3', [hash, salt, userId]);
    } else {
      await pool.query('UPDATE users SET master_password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hash, userId]);
    }
    return true;
  } catch (err) {
    console.error('Update user master password hash error:', err);
    throw err;
  }
}

// Deprecated: Update global settings master password hash
export async function updateMasterPasswordHash(hash) {
  try {
    const result = await pool.query('SELECT id FROM settings WHERE id = 1');
    if (result.rows.length === 0) {
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
    user_id,
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
            id, user_id, folder_id, telegram_file_id, original_filename, file_size,
            file_type, mime_type, description, tags, is_encrypted, encryption_algo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        user_id,
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
export async function createFolder(folderId, userId, name, parentId = null) {
  try {
      let baseSlug = slugify(name);
      if (!baseSlug) baseSlug = 'folder';

      let finalSlug = baseSlug;
      let counter = 1;

      // Handle Unique Slug - per user
      while (true) {
        const conflict = await pool.query(
            "SELECT 1 FROM folders WHERE user_id = $1 AND slug = $2 AND (parent_id = $3 OR (parent_id IS NULL AND $3 IS NULL))",
            [userId, finalSlug, parentId]
        );
        if (conflict.rows.length === 0) break;
        finalSlug = `${baseSlug}-${counter++}`;
      }

    await pool.query(
      `INSERT INTO folders (id, user_id, name, parent_id, slug) VALUES ($1, $2, $3, $4, $5)`,
      [folderId, userId, name, parentId, finalSlug]
    );
    return { id: folderId, user_id: userId, name, parent_id: parentId, slug: finalSlug };
  } catch (err) {
    console.error('Create folder error:', err);
    throw err;
  }
}

export async function getFolders(userId, parentId = null) {
  try {
    if (parentId) {
        const result = await pool.query(
            'SELECT * FROM folders WHERE user_id = $1 AND parent_id = $2 ORDER BY name ASC',
            [userId, parentId]
        );
        return result.rows;
    } else {
        const result = await pool.query(
            'SELECT * FROM folders WHERE user_id = $1 AND parent_id IS NULL ORDER BY name ASC',
            [userId]
        );
        return result.rows;
    }
  } catch (err) {
    console.error('Get folders error:', err);
    throw err;
  }
}

// Alias for compatibility if used elsewhere (deprecated favor getFolders)
export async function getFoldersByParent(userId, parentId) {
    return getFolders(userId, parentId);
}


export async function getAllFolders(userId) {
  try {
    // Fetch all folders for user to build tree on client
    const result = await pool.query(
      'SELECT * FROM folders WHERE user_id = $1 ORDER BY name ASC',
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error('Get all folders error:', err);
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

export async function getFolderByPath(userId, pathStr) {
    if (!pathStr || pathStr === '/' || pathStr.trim() === '') {
        return null; // Root
    }

    const slugs = pathStr.split('/').filter(p => p.length > 0);
    if (slugs.length === 0) return null;

    try {
        const result = await pool.query(`
            WITH RECURSIVE slug_list AS (
                SELECT row_number() OVER () as position, slug_value
                FROM UNNEST($1::text[]) AS slug_list(slug_value)
            ),
            chain AS (
                SELECT id, parent_id, slug, user_id, 1 as idx
                FROM folders
                WHERE user_id = $3 AND slug = (SELECT slug_value FROM slug_list WHERE position = 1) AND parent_id IS NULL

                UNION ALL

                SELECT f.id, f.parent_id, f.slug, f.user_id, c.idx + 1
                FROM folders f
                JOIN chain c ON f.parent_id = c.id
                JOIN slug_list sl ON sl.position = c.idx + 1
                WHERE f.slug = sl.slug_value AND f.user_id = $3
            )
            SELECT * FROM chain WHERE idx = $2;
        `, [slugs, slugs.length, userId]);

        return result.rows[0];
    } catch (err) {
        console.error('Get folder by path error (CTE):', err);
        throw err;
    }
}

export async function renameFolder(folderId, newName) {
  try {
      // Regenerate slug
      let baseSlug = slugify(newName);
      if (!baseSlug) baseSlug = 'folder';

      // We need parent_id to check uniqueness
      const folderRes = await pool.query('SELECT parent_id FROM folders WHERE id = $1', [folderId]);
      if (folderRes.rows.length === 0) throw new Error("Folder not found");
      const parentId = folderRes.rows[0].parent_id;

      let finalSlug = baseSlug;
      let counter = 1;

      while (true) {
        const conflict = await pool.query(
            "SELECT 1 FROM folders WHERE slug = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL)) AND id != $3",
            [finalSlug, parentId, folderId]
        );
        if (conflict.rows.length === 0) break;
        finalSlug = `${baseSlug}-${counter++}`;
      }

    await pool.query(
      'UPDATE folders SET name = $1, slug = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [newName, finalSlug, folderId]
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

export async function getAllFiles(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM files WHERE user_id = $1 ORDER BY uploaded_at DESC',
      [userId]
    );
    return result.rows;
  } catch (err) {
    console.error('Get all files error:', err);
    throw err;
  }
}

export async function getFilesByFolder(userId, folderId) {
  try {
    if (folderId) {
        const result = await pool.query(
        'SELECT * FROM files WHERE user_id = $1 AND folder_id = $2 ORDER BY uploaded_at DESC',
        [userId, folderId]
        );
        return result.rows;
    } else {
        // Return files in root (folder_id is NULL) for the user
        const result = await pool.query(
            'SELECT * FROM files WHERE user_id = $1 AND folder_id IS NULL ORDER BY uploaded_at DESC',
            [userId]
        );
        return result.rows;
    }
  } catch (err) {
    console.error('Get files by folder error:', err);
    throw err;
  }
}

// ... existing file methods ...
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
    // If targetFolderId is null, it moves to root
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
    // Re-check slug uniqueness in new parent
    const folderRes = await pool.query('SELECT name, slug FROM folders WHERE id = $1', [folderId]);
    if (folderRes.rows.length === 0) throw new Error("Folder not found");

    // We try to keep current slug, but if conflict, we append counter
    let finalSlug = folderRes.rows[0].slug;
    let baseSlug = finalSlug.replace(/-\d+$/, ''); // Strip existing counter if any to be safe
    let counter = 1;

    // Resolve conflict in target
    while (true) {
        const conflict = await pool.query(
            "SELECT 1 FROM folders WHERE slug = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL)) AND id != $3",
            [finalSlug, targetParentId, folderId]
        );
        if (conflict.rows.length === 0) break;
        finalSlug = `${baseSlug}-${counter++}`;
    }

    await pool.query(
      'UPDATE folders SET parent_id = $1, slug = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [targetParentId, finalSlug, folderId]
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

export async function getFile(fileId) {
  try {
    const result = await pool.query('SELECT * FROM files WHERE id = $1', [fileId]);
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get file error:', err);
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

/**
 * Wrapper for insertFile - creates a new file record
 * Used by encrypted upload endpoint
 */
export async function createFile(fileData) {
  return insertFile(fileData);
}

/**
 * Wrapper for insertFilePart - creates a new file part record
 * Used by encrypted upload endpoint
 */
export async function createFilePart(partData) {
  return insertFilePart(partData);
}

// ========== STATS FUNCTIONS ==========

export async function createUserStats(userId) {
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO user_stats (id, user_id, total_files, total_size, total_uploads, total_downloads)
       VALUES ($1, $2, 0, 0, 0, 0)
       ON CONFLICT (user_id) DO NOTHING`,
      [id, userId]
    );
    return { id, user_id: userId, total_files: 0, total_size: 0, total_uploads: 0, total_downloads: 0 };
  } catch (err) {
    console.error('Create user stats error:', err);
    throw err;
  }
}

export async function getUserStats(userId) {
  try {
    const result = await pool.query(
      'SELECT * FROM user_stats WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get user stats error:', err);
    throw err;
  }
}

export async function updateUserStats(userId, delta) {
  // delta = { total_files: 1, total_size: 1024, total_uploads: 1, total_downloads: 0 }
  try {
    const stats = await getUserStats(userId);
    if (!stats) {
      await createUserStats(userId);
    }

    const updates = {
      total_files: Number(stats?.total_files || 0) + Number(delta.total_files || 0),
      total_size: Number(stats?.total_size || 0) + Number(delta.total_size || 0),
      total_uploads: Number(stats?.total_uploads || 0) + Number(delta.total_uploads || 0),
      total_downloads: Number(stats?.total_downloads || 0) + Number(delta.total_downloads || 0),
    };

    await pool.query(
      `UPDATE user_stats SET total_files = $1, total_size = $2, total_uploads = $3, total_downloads = $4, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $5`,
      [updates.total_files, updates.total_size, updates.total_uploads, updates.total_downloads, userId]
    );
    return updates;
  } catch (err) {
    console.error('Update user stats error:', err);
    throw err;
  }
}

export async function createFolderStats(folderId, userId) {
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO folder_stats (id, folder_id, user_id, files_count, total_size)
       VALUES ($1, $2, $3, 0, 0)
       ON CONFLICT (folder_id) DO NOTHING`,
      [id, folderId, userId]
    );
    return { id, folder_id: folderId, user_id: userId, files_count: 0, total_size: 0 };
  } catch (err) {
    console.error('Create folder stats error:', err);
    throw err;
  }
}

export async function getFolderStats(folderId) {
  try {
    const result = await pool.query(
      'SELECT * FROM folder_stats WHERE folder_id = $1',
      [folderId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get folder stats error:', err);
    throw err;
  }
}

export async function updateFolderStats(folderId, delta) {
  // delta = { files_count: 1, total_size: 1024 }
  try {
    const stats = await getFolderStats(folderId);
    if (!stats) {
      // Get folder to get user_id
      const folder = await getFolderById(folderId);
      if (folder) {
        await createFolderStats(folderId, folder.user_id);
      }
    }

    const updates = {
      files_count: Math.max(0, Number(stats?.files_count || 0) + Number(delta.files_count || 0)),
      total_size: Math.max(0, Number(stats?.total_size || 0) + Number(delta.total_size || 0)),
    };

    await pool.query(
      `UPDATE folder_stats SET files_count = $1, total_size = $2, updated_at = CURRENT_TIMESTAMP
       WHERE folder_id = $3`,
      [updates.files_count, updates.total_size, folderId]
    );
    return updates;
  } catch (err) {
    console.error('Update folder stats error:', err);
    throw err;
  }
}

export async function createFileStats(fileId, userId) {
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO file_stats (id, file_id, user_id, download_count, view_count)
       VALUES ($1, $2, $3, 0, 0)
       ON CONFLICT (file_id) DO NOTHING`,
      [id, fileId, userId]
    );
    return { id, file_id: fileId, user_id: userId, download_count: 0, view_count: 0 };
  } catch (err) {
    console.error('Create file stats error:', err);
    throw err;
  }
}

export async function getFileStats(fileId) {
  try {
    const result = await pool.query(
      'SELECT * FROM file_stats WHERE file_id = $1',
      [fileId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get file stats error:', err);
    throw err;
  }
}

export async function incrementFileDownloads(fileId) {
  try {
    const stats = await getFileStats(fileId);
    if (!stats) {
      const file = await getFileById(fileId);
      if (file) {
        await createFileStats(fileId, file.user_id);
      }
    }

    await pool.query(
      `UPDATE file_stats SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE file_id = $1`,
      [fileId]
    );
    return true;
  } catch (err) {
    console.error('Increment file downloads error:', err);
    throw err;
  }
}

export async function incrementFileViews(fileId) {
  try {
    const stats = await getFileStats(fileId);
    if (!stats) {
      const file = await getFileById(fileId);
      if (file) {
        await createFileStats(fileId, file.user_id);
      }
    }

    await pool.query(
      `UPDATE file_stats SET view_count = view_count + 1, last_viewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE file_id = $1`,
      [fileId]
    );
    return true;
  } catch (err) {
    console.error('Increment file views error:', err);
    throw err;
  }
}

export async function createBotUsageStats(botId, userId) {
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO bot_usage_stats (id, bot_id, user_id, files_count, total_size, uploads_count)
       VALUES ($1, $2, $3, 0, 0, 0)
       ON CONFLICT (bot_id, user_id) DO NOTHING`,
      [id, botId, userId]
    );
    return { id, bot_id: botId, user_id: userId, files_count: 0, total_size: 0, uploads_count: 0 };
  } catch (err) {
    console.error('Create bot usage stats error:', err);
    throw err;
  }
}

export async function getBotUsageStats(botId) {
  try {
    const result = await pool.query(
      'SELECT * FROM bot_usage_stats WHERE bot_id = $1',
      [botId]
    );
    return result.rows[0] || null;
  } catch (err) {
    console.error('Get bot usage stats error:', err);
    throw err;
  }
}

export async function updateBotUsageStats(botId, delta) {
  // delta = { files_count: 1, total_size: 1024, uploads_count: 1 }
  try {
    const stats = await getBotUsageStats(botId);
    if (!stats) {
      const bot = await pool.query('SELECT user_id FROM user_bots WHERE id = $1', [botId]);
      if (bot.rows.length > 0) {
        await createBotUsageStats(botId, bot.rows[0].user_id);
      }
    }

    const updates = {
      files_count: Math.max(0, Number(stats?.files_count || 0) + Number(delta.files_count || 0)),
      total_size: Math.max(0, Number(stats?.total_size || 0) + Number(delta.total_size || 0)),
      uploads_count: Math.max(0, Number(stats?.uploads_count || 0) + Number(delta.uploads_count || 0)),
    };

    await pool.query(
      `UPDATE bot_usage_stats SET files_count = $1, total_size = $2, uploads_count = $3, updated_at = CURRENT_TIMESTAMP
       WHERE bot_id = $4`,
      [updates.files_count, updates.total_size, updates.uploads_count, botId]
    );
    return updates;
  } catch (err) {
    console.error('Update bot usage stats error:', err);
    throw err;
  }
}

// ========== BOT ROTATION FUNCTIONS ==========

export async function getNextBotForUpload(userId) {
  try {
    const bots = await getUserBots(userId);

    if (bots.length === 0) {
      // No user bots, return null (will use system default)
      return null;
    }

    // Find bot with lowest upload_counter
    const selectedBot = bots.reduce((min, b) =>
      (b.upload_counter || 0) < (min.upload_counter || 0) ? b : min
    );

    return selectedBot;
  } catch (err) {
    console.error('Get next bot for upload error:', err);
    throw err;
  }
}

export async function incrementBotUploadCounter(botId) {
  try {
    await pool.query(
      `UPDATE user_bots SET upload_counter = COALESCE(upload_counter, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [botId]
    );
    return true;
  } catch (err) {
    console.error('Increment bot upload counter error:', err);
    throw err;
  }
}

export async function resetBotUploadCounters(userId) {
  try {
    await pool.query(
      `UPDATE user_bots SET upload_counter = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [userId]
    );
    return true;
  } catch (err) {
    console.error('Reset bot upload counters error:', err);
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

export { pool };




