import { StorageProvider } from './StorageProvider.js';
import { sendFileToTelegram, getFileDownloadUrl, deleteFileFromTelegram } from '../telegram.js';

export class TelegramStorageProvider extends StorageProvider {
  async uploadChunk(userId, buffer, filename) {
    return sendFileToTelegram(userId, buffer, filename);
  }

  async getDownloadUrl(userId, storageId) {
    return getFileDownloadUrl(userId, storageId);
  }

  async deleteChunk(storageId) {
    return deleteFileFromTelegram(storageId);
  }
}
