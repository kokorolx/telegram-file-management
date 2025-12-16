import { initDb, closeDb } from '../lib/db.js';

async function main() {
  try {
    console.log('Running database initialization...');
    await initDb();
    console.log('✓ Database initialization complete');
  } catch (err) {
    console.error('Error in database initialization:', err);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();
