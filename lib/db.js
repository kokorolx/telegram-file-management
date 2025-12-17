// PostgreSQL Database Layer
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

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
    // Create folders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT,
        parent_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
        UNIQUE (parent_id, slug) -- Ensure unique slugs within a directory (parent can be NULL)
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

        // Slug migration
        await pool.query(`ALTER TABLE folders ADD COLUMN IF NOT EXISTS slug TEXT`);
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
      let baseSlug = slugify(name);
      if (!baseSlug) baseSlug = 'folder';

      let finalSlug = baseSlug;
      let counter = 1;

      // Handle Unique Slug
      while (true) {
        // Only check 1 level depth.
        // There is a slight race condition here, but low risk for personal app.
        const conflict = await pool.query(
            "SELECT 1 FROM folders WHERE slug = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))",
            [finalSlug, parentId]
        );
        if (conflict.rows.length === 0) break;
        finalSlug = `${baseSlug}-${counter++}`;
      }

    await pool.query(
      `INSERT INTO folders (id, name, parent_id, slug) VALUES ($1, $2, $3, $4)`,
      [folderId, name, parentId, finalSlug]
    );
    return { id: folderId, name, parent_id: parentId, slug: finalSlug };
  } catch (err) {
    console.error('Create folder error:', err);
    throw err;
  }
}

export async function getFolders(parentId = null) {
  try {
    if (parentId) {
        const result = await pool.query(
            'SELECT * FROM folders WHERE parent_id = $1 ORDER BY name ASC',
            [parentId]
        );
        return result.rows;
    } else {
        const result = await pool.query(
            'SELECT * FROM folders WHERE parent_id IS NULL ORDER BY name ASC'
        );
        return result.rows;
    }
  } catch (err) {
    console.error('Get folders error:', err);
    throw err;
  }
}

// Alias for compatibility if used elsewhere (deprecated favor getFolders)
export async function getFoldersByParent(parentId) {
    return getFolders(parentId);
}


export async function getAllFolders() {
  try {
    // Fetch all folders to build tree on client
    const result = await pool.query(
      'SELECT * FROM folders ORDER BY name ASC'
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

export async function getFolderByPath(pathStr) {
    if (!pathStr || pathStr === '/' || pathStr.trim() === '') {
        return null; // Root
    }

    const slugs = pathStr.split('/').filter(p => p.length > 0);
    if (slugs.length === 0) return null;

    try {
        const query = `
            WITH RECURSIVE path_resolution AS (
                -- Base case: find the root folder matching the first slug
                SELECT id, name, slug, parent_id, 1 AS depth
                FROM folders
                WHERE slug = $1 AND parent_id IS NULL

                UNION ALL

                -- Recursive step: find child folder matching the next slug
                SELECT f.id, f.name, f.slug, f.parent_id, pr.depth + 1
                FROM folders f
                JOIN path_resolution pr ON f.parent_id = pr.id
                WHERE f.slug = $${2} -- We need dynamic parameter binding for array elements ?? No, PG arrays
            )
            SELECT * FROM path_resolution;
        `;

        // Dynamic SQL construction for the Recursive CTE in Postgres with variable depth is tricky purely with params for the WHERE clause inside recursion if we want strict level matching.
        // A cleaner way in PG is checking the whole array path or simpler loop if depth isn't huge.
        // BUT, we can use an unrolled approach or strict path matching logic if we had materialized paths.

        // Better Approach with CTE matches segments:
        /*
            WITH RECURSIVE folder_path AS (
                SELECT id, parent_id, slug, ARRAY[slug] as path_slugs
                FROM folders
                WHERE parent_id IS NULL AND slug = $1

                UNION ALL

                SELECT f.id, f.parent_id, f.slug, fp.path_slugs || f.slug
                FROM folders f
                JOIN folder_path fp ON f.parent_id = fp.id
                WHERE f.slug = $2 -- effectively the next slug
            )
        */

        // Complexity: we have N slugs.
        // Let's stick to the method that resolves step by step in one query or simply fetch the final node.
        // Actually, for moderate depth, the loop in JS (current implementation) is N queries.
        // O(1) query requires passing the array of slugs and verifying the chain.

        const result = await pool.query(`
            WITH RECURSIVE slug_list AS (
                SELECT row_number() OVER () as position, slug_value
                FROM UNNEST($1::text[]) AS slug_list(slug_value)
            ),
            chain AS (
                SELECT id, parent_id, slug, 1 as idx
                FROM folders
                WHERE slug = (SELECT slug_value FROM slug_list WHERE position = 1) AND parent_id IS NULL

                UNION ALL

                SELECT f.id, f.parent_id, f.slug, c.idx + 1
                FROM folders f
                JOIN chain c ON f.parent_id = c.id
                JOIN slug_list sl ON sl.position = c.idx + 1
                WHERE f.slug = sl.slug_value
            )
            SELECT * FROM chain WHERE idx = $2;
        `, [slugs, slugs.length]);

        return result.rows[0];
    } catch (err) {
        console.error('Get folder by path error (CTE):', err);
        // Fallback or throw?
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
    if (folderId) {
        const result = await pool.query(
        'SELECT * FROM files WHERE folder_id = $1 ORDER BY uploaded_at DESC',
        [folderId]
        );
        return result.rows;
    } else {
        // Return files in root (folder_id is NULL)
        const result = await pool.query(
            'SELECT * FROM files WHERE folder_id IS NULL ORDER BY uploaded_at DESC'
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

export async function closeDb() {
  try {
    await pool.end();
  } catch (err) {
    console.error('Close database error:', err);
  }
}




