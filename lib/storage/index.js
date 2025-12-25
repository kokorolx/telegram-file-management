import { config } from '../config.js';
import { TelegramStorageProvider } from './TelegramStorageProvider.js';
import { S3StorageProvider } from './S3StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';

class StorageProviderFactory {
  constructor() {
    this.providers = {}; // Lazy-load providers
    this.cachedProvider = null;
  }

  getProvider() {
    // Return cached provider if already loaded
    if (this.cachedProvider) {
      return this.cachedProvider;
    }

    const backend = config.storageBackend;
    
    // Lazy-load the requested provider only
    if (!this.providers[backend]) {
      if (backend === 'TELEGRAM') {
        this.providers[backend] = new TelegramStorageProvider();
      } else if (backend === 'S3') {
        this.providers[backend] = new S3StorageProvider();
      } else if (backend === 'LOCAL') {
        this.providers[backend] = new LocalStorageProvider();
      } else {
        console.warn(`[STORAGE] Unknown storage backend "${backend}", falling back to TELEGRAM`);
        this.providers.TELEGRAM = new TelegramStorageProvider();
        this.cachedProvider = this.providers.TELEGRAM;
        return this.cachedProvider;
      }
    }

    console.log(`[STORAGE] Using backend: ${backend}`);
    this.cachedProvider = this.providers[backend];
    return this.cachedProvider;
  }
}

export const storageProviderFactory = new StorageProviderFactory();
export const storageProvider = storageProviderFactory.getProvider();
