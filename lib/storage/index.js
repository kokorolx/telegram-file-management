import { config } from '../config.js';
import { TelegramStorageProvider } from './TelegramStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';

class StorageProviderFactory {
  constructor() {
    this.providers = {
      TELEGRAM: new TelegramStorageProvider(),
      S3: new S3StorageProvider(),
    };
  }

  getProvider() {
    const backend = config.storageBackend;
    const provider = this.providers[backend];

    if (!provider) {
      console.warn(`[STORAGE] Unknown storage backend "${backend}", falling back to TELEGRAM`);
      return this.providers.TELEGRAM;
    }

    return provider;
  }
}

export const storageProviderFactory = new StorageProviderFactory();
export const storageProvider = storageProviderFactory.getProvider();
