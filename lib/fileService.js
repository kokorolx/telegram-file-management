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
      auth_tag
    } = body;

    let fileRecord = await fileRepository.findById(file_id);

    // Step 1: Create file entry on first chunk
    if (part_number === 1 && !fileRecord) {
      const fileExt = getFileExtension(original_filename);
      const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';
      const decryptedSize = parseInt(chunk_size, 10);

      fileRecord = await fileRepository.save({
        id: file_id,
        user_id: userId,
        folder_id: folder_id || null,
        original_filename,
        file_size: decryptedSize * total_parts, // Initial estimate
        file_type: fileExt,
        mime_type: mimeType,
        is_encrypted: true,
        encryption_algo: 'AES-256-GCM'
      });
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
    const isLastChunk = part_number === total_parts;
    if (isLastChunk) {
      const finalFileSize = chunk_size * total_parts;
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
    // Logic for deleting file and its parts
    await this.getFileParts(id);
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
