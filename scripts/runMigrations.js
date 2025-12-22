/**
 * Migration Runner
 * 
 * Executes pending TypeORM migrations to update the database schema.
 * 
 * Usage:
 *   node scripts/runMigrations.js
 * 
 * This script:
 *   1. Initializes the data source
 *   2. Runs all pending migrations
 *   3. Reports the results
 *   4. Exits with appropriate status code
 */

import { dataSource } from '../lib/data-source.js';

async function runMigrations() {
  try {
    console.log('🔧 Initializing data source...');
    await dataSource.initialize();
    console.log('✓ Data source initialized');

    console.log('\n📋 Running pending migrations...');
    const migrations = await dataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('✓ No pending migrations (database is up to date)');
    } else {
      console.log(`✓ Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach((migration, index) => {
        console.log(`  ${index + 1}. ${migration.name}`);
      });
    }

    console.log('\n✅ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigrations();
