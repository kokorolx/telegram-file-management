import { filePartRepository } from '../lib/repositories/FilePartRepository.js';
import { dataSource } from '../lib/data-source.js';

async function checkFileParts() {
  await dataSource.initialize();

  const fileId = 'c95212b5-91ee-418d-a584-3624f2d23e76';
  const parts = await filePartRepository.findByFileId(fileId);

  console.log(`Checking parts for file: ${fileId}`);
  parts.forEach(p => {
    console.log(`Part ${p.part_number}: BackupID=${p.backup_storage_id}, Backend=${p.backup_backend}`);
  });

  await dataSource.destroy();
}

checkFileParts().catch(console.error);
