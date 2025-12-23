import { StorageProvider } from './StorageProvider.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, '../../.tmp/uploads');

/**
 * Local file system storage for development/testing
 * Stores encrypted chunks in .tmp/uploads instead of Telegram
 */
export class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      console.log(`[LocalStorage] Created upload directory: ${UPLOAD_DIR}`);
    }
  }

  async uploadChunk(userId, buffer, filename) {
    try {
      const userDir = path.join(UPLOAD_DIR, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      const filepath = path.join(userDir, filename);
      fs.writeFileSync(filepath, buffer);
      
      const storageId = `local:${userId}:${filename}`;
      console.log(`[LocalStorage] Uploaded chunk: ${filename} (${buffer.length} bytes) to ${filepath}`);
      
      return storageId;
    } catch (error) {
      console.error(`[LocalStorage] Upload failed for ${filename}:`, error);
      throw new Error(`Local storage upload failed: ${error.message}`);
    }
  }

  async getDownloadUrl(userId, storageId) {
    try {
      // Format: local:userId:filename
      const [, storedUserId, filename] = storageId.split(':');
      
      if (storedUserId !== userId) {
        throw new Error('User ID mismatch for local storage');
      }

      // Return an API endpoint that serves the file
      return `/api/download/local/${userId}/${filename}`;
    } catch (error) {
      console.error(`[LocalStorage] Failed to get download URL for ${storageId}:`, error);
      throw new Error(`Local storage download URL failed: ${error.message}`);
    }
  }

  async deleteChunk(storageId) {
    try {
      const [, userId, filename] = storageId.split(':');
      const filepath = path.join(UPLOAD_DIR, userId, filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[LocalStorage] Deleted chunk: ${filepath}`);
      }

      // Cleanup empty user directory
      const userDir = path.join(UPLOAD_DIR, userId);
      try {
        if (fs.existsSync(userDir) && fs.readdirSync(userDir).length === 0) {
          fs.rmdirSync(userDir);
          console.log(`[LocalStorage] Deleted empty user directory: ${userDir}`);
        }
      } catch (dirErr) {
        // Ignore errors deleting directory (may have other files)
      }

      return true;
    } catch (error) {
      console.error(`[LocalStorage] Delete failed for ${storageId}:`, error);
      throw new Error(`Local storage delete failed: ${error.message}`);
    }
  }

  /**
   * Get file from local storage
   */
  async getFile(storageId) {
    try {
      const [, userId, filename] = storageId.split(':');
      const filepath = path.join(UPLOAD_DIR, userId, filename);

      if (!fs.existsSync(filepath)) {
        throw new Error(`File not found: ${filepath}`);
      }

      return fs.readFileSync(filepath);
    } catch (error) {
      console.error(`[LocalStorage] Read failed for ${storageId}:`, error);
      throw new Error(`Local storage read failed: ${error.message}`);
    }
  }
}
