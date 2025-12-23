import { dataSource, getDataSource } from './lib/data-source.js';

async function checkFiles() {
  try {
    await getDataSource();
    const files = await dataSource.query(`
      SELECT id, original_filename, is_fragmented, mime_type, uploaded_at, is_complete
      FROM files
      WHERE uploaded_at > NOW() - INTERVAL '1 hour'
      ORDER BY uploaded_at DESC
    `);
    console.log('Files from the last hour:');
    console.table(files);
    process.exit(0);
  } catch (err) {
    console.error('Error checking files:', err);
    process.exit(1);
  }
}

checkFiles();
