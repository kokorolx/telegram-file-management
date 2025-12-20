import { fileRepository } from '../lib/repositories/FileRepository.js';
import { filePartRepository } from '../lib/repositories/FilePartRepository.js';
import { folderRepository } from '../lib/repositories/FolderRepository.js';
import { storageProvider } from '../lib/storage/index.js';
import { config } from '../lib/config.js';

/**
 * Enterprise Backup Script
 * Exports core metadata to the configured storage backend.
 */
async function runBackup() {
  if (!config.isEnterprise) {
    console.log("Enterprise Mode disabled. Skipping backup.");
    return;
  }

  console.log("[BACKUP] Starting metadata backup...");

  try {
    const files = await fileRepository.find();
    const parts = await filePartRepository.find();
    const folders = await folderRepository.find();

    const backupData = {
      timestamp: new Date().toISOString(),
      files,
      parts,
      folders
    };

    const buffer = Buffer.from(JSON.stringify(backupData, null, 2));
    const filename = `backup-metadata-${Date.now()}.json`;

    const storageId = await storageProvider.uploadChunk('SYSTEM_BACKUP', buffer, filename);

    console.log(`[BACKUP] ✓ Backup completed successfully. Storage ID: ${storageId}`);
  } catch (err) {
    console.error("[BACKUP] ✗ Backup failed:", err);
    process.exit(1);
  }
}

runBackup();
