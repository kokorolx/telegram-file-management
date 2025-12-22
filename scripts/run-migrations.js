import { dataSource } from '../lib/data-source.js';

async function runMigrations() {
    try {
        console.log('Initializing database connection...');
        await dataSource.initialize();
        console.log('✓ Database connected');

        console.log('Running pending migrations...');
        const migrations = await dataSource.runMigrations();

        if (migrations.length === 0) {
            console.log('✓ No pending migrations');
        } else {
            console.log(`✓ Executed ${migrations.length} migration(s):`);
            migrations.forEach(m => console.log(`  - ${m.name}`));
        }
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    } finally {
        await dataSource.destroy();
    }
}

runMigrations();
