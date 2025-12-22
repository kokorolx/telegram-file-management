import { v4 as uuidv4 } from 'uuid';
import { fileRepository } from './repositories/FileRepository.js';
import { filePartRepository } from './repositories/FilePartRepository.js';
import { userBotRepository } from './repositories/UserBotRepository.js';
import { statsService } from './services/StatsService.js';
import { getFileExtension, getMimeType } from './utils.js';
import { config } from './config.js';
import { auditLogRepository } from './repositories/AuditLogRepository.js';
import { addVideoJob } from './videoWorker.js';
import { healthService } from './services/HealthService.js';

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
      encryption_version,
      is_compressed,
      chunk_sizes      // NEW: Array of chunk sizes from browser
    } = body;

    const isLastChunk = parseInt(part_number, 10) === parseInt(total_parts, 10);
    const partNum = parseInt(part_number, 10);
    const totalParts = parseInt(total_parts, 10);

    let fileRecord = await fileRepository.findById(file_id);

    // Step 1: Create or Update file entry on first chunk
    if (partNum === 1) {
      const fileExt = getFileExtension(original_filename);
      const mimeType = mime_type || getMimeType(fileExt) || 'application/octet-stream';

      // Calculate actual file size from chunk sizes array
      const actualFileSize = chunk_sizes
        ? chunk_sizes.reduce((sum, size) => sum + size, 0)
        : (parseInt(chunk_size, 10) * totalParts);

      if (!fileRecord) {
        fileRecord = await fileRepository.save({
          id: file_id,
          user_id: userId,
          folder_id: folder_id || null,
          original_filename,
          file_size: actualFileSize,
          file_type: fileExt,
          mime_type: mimeType,
          is_encrypted: true,
          encryption_algo: 'AES-256-GCM',
          encrypted_file_key: encrypted_file_key || null,
          key_iv: key_iv || null,
          encryption_version: encryption_version || 1,
          is_complete: false,
          total_parts_expected: totalParts,
          chunk_sizes: chunk_sizes  // Store the chunk plan
        });

        // Save chunk plan for later resume
        if (chunk_sizes) {
          await fileRepository.saveChunkPlan(file_id, chunk_sizes);
        }
      } else {
        // Resume: Update existing record
        fileRecord.encrypted_file_key = encrypted_file_key || fileRecord.encrypted_file_key;
        fileRecord.key_iv = key_iv || fileRecord.key_iv;
        fileRecord.encryption_version = encryption_version || fileRecord.encryption_version;
        fileRecord.total_parts_expected = totalParts;
        fileRecord.updated_at = new Date();
        await fileRepository.save(fileRecord);
      }
    }

    // Step 2: Check if this part already exists (duplicate prevention)
    const existingPart = await filePartRepository.findByFileIdAndPart(file_id, partNum);
    if (existingPart) {
      console.log(`[RESUME] Part ${partNum} already exists, skipping duplicate`);
      // Return success for idempotency
      return { fileRecord, isLastChunk, skipped: true };
    }

    // Step 3: Select bot for tracking
    const bot = await userBotRepository.getNextBotForUpload(userId);
    const botId = bot?.id || null;

    // Step 4: Save chunk metadata
    await filePartRepository.save({
      id: uuidv4(),
      file_id,
      telegram_file_id,
      part_number: partNum,
      size: chunk_size,
      iv,
      auth_tag,
      bot_id: botId,
      is_compressed: is_compressed || false,
      backup_storage_id: body.backup_storage_id || null,
      backup_backend: body.backup_backend || null,
    });

    if (botId) {
      await userBotRepository.incrementUploadCount(botId);
    }

    // Step 5: Finalize if last chunk
    if (isLastChunk) {
      // Calculate total size based on all parts
      const parts = await filePartRepository.findByFileId(file_id);
      const finalFileSize = parts.reduce((sum, p) => sum + BigInt(p.size || 0), BigInt(0));
      await fileRepository.markComplete(file_id);
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

    if (config.isEnterprise) {
      await auditLogRepository.log(userId, 'FILE_UPLOAD', 'FILE', fileId, { totalSize });
    }

    // Video processing check - available for both Self-host and Enterprise if infra is UP
    const capabilities = await healthService.getSystemCapabilities();

    if (capabilities.can_process_video) {
      const file = await this.getFileById(fileId);
      if (file && (file.mime_type?.startsWith('video/') || file.file_type === 'mp4')) {
          await addVideoJob(fileId, userId, file.original_filename);
      }
    } else {
      console.warn(`HealthCheck: Skipping video job for ${fileId} - Infrastructure not supported/offline`, capabilities.health);
    }

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

    // Delete chunks from storage
    const { storageProvider } = await import('./storage/index.js');
    for (const part of parts) {
      try {
        await storageProvider.deleteChunk(part.telegram_file_id);
      } catch (err) {
        console.warn(`Failed to delete chunk ${part.telegram_file_id} from storage:`, err);
      }
    }

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

    if (config.isEnterprise) {
      await auditLogRepository.log(file.user_id, 'FILE_DELETE', 'FILE', id, { filename: file.original_filename });
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
   * Implements retry logic with exponential backoff and S3 fallback.
   */
  async getDownloadStream(userId, parts, key, s3Config = null) {
    const { storageProvider } = await import('./storage/index.js');
    const { S3StorageProvider } = await import('./storage/S3StorageProvider.js');
    const s3Provider = new S3StorageProvider();

    const fetchWithRetry = async (part) => {
      const maxRetries = 3;
      const delays = [1000, 2000, 4000]; // Exponential backoff

      // Try Telegram first with retries
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const dlUrl = await storageProvider.getDownloadUrl(userId, part.telegram_file_id);
          const res = await fetch(dlUrl);
          if (res.ok) {
            return Buffer.from(await res.arrayBuffer());
          }
          console.warn(`[DOWNLOAD] Attempt ${attempt + 1} failed for part ${part.part_number} (HTTP ${res.status})`);
        } catch (err) {
          console.warn(`[DOWNLOAD] Attempt ${attempt + 1} failed for part ${part.part_number}:`, err.message);
        }
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
      }

      // Fallback to S3 backup if available
      if (part.backup_storage_id && s3Config) {
        console.log(`[FALLBACK] Using S3 backup for part ${part.part_number}`);
        try {
          const backupUrl = await s3Provider.getDownloadUrl(userId, part.backup_storage_id, s3Config);
          if (backupUrl) {
            const backupRes = await fetch(backupUrl);
            if (backupRes.ok) {
              return Buffer.from(await backupRes.arrayBuffer());
            }
          }
        } catch (backupErr) {
          console.error(`[FALLBACK] S3 backup also failed for part ${part.part_number}:`, backupErr.message);
        }
      }

      throw new Error(`Failed to fetch part ${part.part_number} after ${maxRetries} retries and backup fallback`);
    };

    return new ReadableStream({
      async start(controller) {
        try {
          for (const part of parts) {
            const encryptedBuffer = await fetchWithRetry(part);
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
    const { storageProvider } = await import('./storage/index.js');
    return new ReadableStream({
      async start(controller) {
        try {
          for (const { part, byteOffset } of partsNeeded) {
            const dlUrl = await storageProvider.getDownloadUrl(userId, part.telegram_file_id);
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
