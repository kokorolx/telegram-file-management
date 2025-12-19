import { v4 as uuidv4 } from 'uuid';
import { fileRepository } from './repositories/FileRepository.js';
import { filePartRepository } from './repositories/FilePartRepository.js';
import { userBotRepository } from './repositories/UserBotRepository.js';
import { statsService } from './services/StatsService.js';
import { getFileExtension, getMimeType } from './utils.js';

export class FileService {
  /**
   * Handles an individual chunk upload from the browser.
   * Browser provides the encrypted data already uploaded to Telegram or to be tracked.
   */
  async handleUploadChunk(userId, body) {
    const {
      file_id,
      part_number,
      total_parts,
      chunk_size,
      original_filename,
      mime_type,
      folder_id,
      telegram_file_id,
      iv,
      auth_tag,
      encrypted_file_key,
      key_iv,
      encryption_version
    } = body;

    let fileRecord = await fileRepository.findById(file_id);

    // Step 1: Create or Update file entry on first chunk
    if (part_number === 1) {
      const fileExt = getFileExtension(original_filename);
      const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';
      const decryptedSize = parseInt(chunk_size, 10);

      if (!fileRecord) {
        fileRecord = await fileRepository.save({
          id: file_id,
          user_id: userId,
          folder_id: folder_id || null,
          original_filename,
          file_size: decryptedSize * total_parts,
          file_type: fileExt,
          mime_type: mimeType,
          is_encrypted: true,
          encryption_algo: 'AES-256-GCM',
          encrypted_file_key: encrypted_file_key || null,
          key_iv: key_iv || null,
          encryption_version: encryption_version || 1
        });
      } else {
        // Migration / Re-upload: Update existing record
        fileRecord.encrypted_file_key = encrypted_file_key || fileRecord.encrypted_file_key;
        fileRecord.key_iv = key_iv || fileRecord.key_iv;
        fileRecord.encryption_version = encryption_version || fileRecord.encryption_version;
        fileRecord.file_size = decryptedSize * total_parts;
        fileRecord.updated_at = new Date();
        await fileRepository.save(fileRecord);

        // Clear OLD chunks to avoid orphans
        await filePartRepository.deleteByFileId(file_id);
      }
    }

    // Step 2: Select bot for tracking
    const bot = await userBotRepository.getNextBotForUpload(userId);
    const botId = bot?.id || null;

    // Step 3: Save chunk metadata
    await filePartRepository.save({
      id: uuidv4(),
      file_id,
      telegram_file_id,
      part_number,
      size: chunk_size,
      iv,
      auth_tag,
      bot_id: botId
    });

    if (botId) {
      await userBotRepository.incrementUploadCount(botId);
    }

    // Step 4: Finalize if last chunk
    if (isLastChunk) {
      // Calculate total size based on all parts
      const parts = await filePartRepository.findByFileId(file_id);
      const finalFileSize = parts.reduce((sum, p) => sum + BigInt(p.size || 0), BigInt(0));
      await this.finalizeFileUpload(userId, file_id, finalFileSize, folder_id, botId);
    }

    return { fileRecord, isLastChunk };
  }

  async finalizeFileUpload(userId, fileId, totalSize, folderId, botId) {
    await statsService.updateUserStats(userId, {
      total_files: 1,
      total_size: totalSize,
      total_uploads: 1
    });

    await statsService.createFileStats(fileId, userId);

    if (folderId) {
      await statsService.updateFolderStats(folderId, {
        files_count: 1,
        total_size: totalSize
      });
    }

    if (botId) {
      await statsService.updateBotUsageStats(botId, userId, {
        files_count: 1,
        total_size: totalSize,
        uploads_count: 1
      });
    }
  }

  async getFileById(id) {
    return fileRepository.findById(id);
  }

  async getFileParts(fileId) {
    return filePartRepository.findByFileId(fileId);
  }

  async deleteFile(id) {
    const file = await fileRepository.findById(id);
    if (!file) return;

    const parts = await this.getFileParts(id);
    const botId = parts.length > 0 ? parts[0].bot_id : null;

    // Decrement stats
    await statsService.updateUserStats(file.user_id, {
      total_files: -1,
      total_size: -BigInt(file.file_size || 0),
    });

    if (file.folder_id) {
      await statsService.updateFolderStats(file.folder_id, {
        files_count: -1,
        total_size: -BigInt(file.file_size || 0)
      });
    }

    if (botId && file.user_id) {
      await statsService.updateBotUsageStats(botId, file.user_id, {
        files_count: -1,
        total_size: -BigInt(file.file_size || 0)
      });
    }

    await fileRepository.delete(id);
    // Parts deleted via CASCADE
  }

  async moveFile(id, newFolderId) {
    const file = await fileRepository.findById(id);
    if (!file) throw new Error("File not found");

    const oldFolderId = file.folder_id;
    if (oldFolderId === newFolderId) return true;

    await fileRepository.update(id, {
      folder_id: newFolderId || null,
      updated_at: new Date()
    });

    // Update folder stats
    if (oldFolderId) {
      await statsService.updateFolderStats(oldFolderId, {
        files_count: -1,
        total_size: -Number(file.file_size)
      });
    }
    if (newFolderId) {
      await statsService.updateFolderStats(newFolderId, {
        files_count: 1,
        total_size: Number(file.file_size)
      });
    }

    return true;
  }

  /**
   * Creates a ReadableStream for a full file download.
   */
  async getDownloadStream(userId, parts, key) {
    const { getFileDownloadUrl } = await import('./telegram.js');
    return new ReadableStream({
      async start(controller) {
        try {
          for (const part of parts) {
            const dlUrl = await getFileDownloadUrl(userId, part.telegram_file_id);
            const res = await fetch(dlUrl);
            if (!res.ok) throw new Error(`Failed to fetch part ${part.part_number}`);

            const encryptedBuffer = Buffer.from(await res.arrayBuffer());
            const decrypted = authService.decryptBuffer(
              encryptedBuffer,
              key,
              Buffer.from(part.iv, 'hex'),
              Buffer.from(part.auth_tag, 'hex')
            );

            controller.enqueue(decrypted);
          }
          controller.close();
        } catch (e) {
          console.error("Stream error in FileService:", e);
          controller.error(e);
        }
      }
    });
  }

  /**
   * Creates a ReadableStream for a partial range download (for streaming).
   */
  async getRangeDownloadStream(userId, partsNeeded, key, start, end) {
    const { getFileDownloadUrl } = await import('./telegram.js');
    return new ReadableStream({
      async start(controller) {
        try {
          for (const { part, byteOffset } of partsNeeded) {
            const dlUrl = await getFileDownloadUrl(userId, part.telegram_file_id);
            const res = await fetch(dlUrl);
            if (!res.ok) throw new Error(`Failed to fetch part ${part.part_number}`);

            const encryptedBuffer = Buffer.from(await res.arrayBuffer());
            const decrypted = authService.decryptBuffer(
              encryptedBuffer,
              key,
              Buffer.from(part.iv, 'hex'),
              Buffer.from(part.auth_tag, 'hex')
            );

            const partStart = Math.max(0, start - byteOffset);
            const partEnd = Math.min(decrypted.length - 1, end - byteOffset);

            if (partStart <= partEnd) {
              controller.enqueue(decrypted.subarray(partStart, partEnd + 1));
            }
          }
          controller.close();
        } catch (e) {
          console.error("Range stream error in FileService:", e);
          controller.error(e);
        }
      }
    });
  }
}

export const fileService = new FileService();
