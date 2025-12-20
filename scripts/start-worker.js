import { startVideoWorker } from '../lib/videoWorker.js';
import { dataSource } from '../lib/data-source.js';

async function run() {
  console.log('[WORKER] Initializing worker process...');

  try {
    // We might need DB connection for metadata updates
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      console.log('[WORKER] Database connection established');
    }

    startVideoWorker();
    console.log('[WORKER] Video Processing Worker is now listening for jobs');

  } catch (error) {
    console.error('[WORKER] Critical failure on startup:', error);
    process.exit(1);
  }
}

run();
