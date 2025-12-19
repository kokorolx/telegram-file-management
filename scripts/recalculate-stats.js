import { getDataSource } from '../lib/data-source.js';
import { UserStat } from '../lib/entities/UserStat.js';
import { FolderStat } from '../lib/entities/FolderStat.js';
import { BotUsageStat } from '../lib/entities/BotUsageStat.js';
import { File } from '../lib/entities/File.js';
import { FilePart } from '../lib/entities/FilePart.js';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  try {
    console.log('Starting stats recalculation...');
    const ds = await getDataSource();

    const fileRepo = ds.getRepository(File);
    const userStatRepo = ds.getRepository(UserStat);
    const folderStatRepo = ds.getRepository(FolderStat);
    const botUsageStatRepo = ds.getRepository(BotUsageStat);

    // 1. Clear existing stats
    console.log('Clearing existing statistics...');
    await userStatRepo.clear();
    await folderStatRepo.clear();
    await botUsageStatRepo.clear();

    // 2. Fetch all files
    console.log('Fetching all files...');
    const allFiles = await fileRepo.find({
        relations: ['parts']
    });

    const userStats = {};
    const folderStats = {};
    const botStats = {};

    console.log(`Processing ${allFiles.length} files...`);

    for (const file of allFiles) {
      const userId = file.user_id;
      const folderId = file.folder_id;
      const fileSize = BigInt(file.file_size || 0);

      // User Stats aggregation
      if (userId) {
        if (!userStats[userId]) {
          userStats[userId] = { total_files: 0, total_size: BigInt(0), total_uploads: 0, total_downloads: 0 };
        }
        userStats[userId].total_files += 1;
        userStats[userId].total_size += fileSize;
        userStats[userId].total_uploads += 1;
      }

      // Folder Stats aggregation
      if (folderId && userId) {
        if (!folderStats[folderId]) {
          folderStats[folderId] = { folder_id: folderId, user_id: userId, files_count: 0, total_size: BigInt(0) };
        }
        folderStats[folderId].files_count += 1;
        folderStats[folderId].total_size += fileSize;
      }

      // Bot Usage Stats aggregation
      if (userId && file.parts && file.parts.length > 0) {
        const botId = file.parts[0].bot_id;
        if (botId) {
          const key = `${botId}_${userId}`;
          if (!botStats[key]) {
            botStats[key] = { bot_id: botId, user_id: userId, files_count: 0, total_size: BigInt(0), uploads_count: 0 };
          }
          botStats[key].files_count += 1;
          botStats[key].total_size += fileSize;
          botStats[key].uploads_count += 1;
        }
      }
    }

    // 3. Save User Stats
    console.log('Saving User Statistics...');
    for (const userId in userStats) {
      const data = userStats[userId];
      await userStatRepo.save({
        id: uuidv4(),
        user_id: userId,
        ...data
      });
    }

    // 4. Save Folder Stats
    console.log('Saving Folder Statistics...');
    for (const folderId in folderStats) {
      await folderStatRepo.save({
        id: uuidv4(),
        ...folderStats[folderId]
      });
    }

    // 5. Save Bot Usage Stats
    console.log('Saving Bot Usage Statistics...');
    for (const key in botStats) {
      await botUsageStatRepo.save({
        id: uuidv4(),
        ...botStats[key]
      });
    }

    console.log('✓ Stats recalculation complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error during stats recalculation:', err);
    process.exit(1);
  }
}

main();
