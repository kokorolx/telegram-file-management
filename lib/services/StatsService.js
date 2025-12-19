import { v4 as uuidv4 } from 'uuid';
import { getDataSource } from '../data-source.js';
import { UserStat } from '../entities/UserStat.js';
import { FolderStat } from '../entities/FolderStat.js';
import { FileStat } from '../entities/FileStat.js';
import { BotUsageStat } from '../entities/BotUsageStat.js';
import { folderRepository } from '../repositories/FolderRepository.js';

export class StatsService {
  async getUserStatRepo() {
    const ds = await getDataSource();
    return ds.getRepository(UserStat);
  }

  async getFolderStatRepo() {
    const ds = await getDataSource();
    return ds.getRepository(FolderStat);
  }

  async getFileStatRepo() {
    const ds = await getDataSource();
    return ds.getRepository(FileStat);
  }

  async getBotUsageStatRepo() {
    const ds = await getDataSource();
    return ds.getRepository(BotUsageStat);
  }

  async createUserStats(userId) {
    const repo = await this.getUserStatRepo();
    const stat = repo.create({
      id: uuidv4(),
      user_id: userId,
      total_files: 0,
      total_size: 0,
      total_uploads: 0,
      total_downloads: 0
    });
    return repo.save(stat);
  }

  async getUserStats(userId) {
    const repo = await this.getUserStatRepo();
    return repo.findOne({ where: { user_id: userId } });
  }

  async updateUserStats(userId, delta) {
    const repo = await this.getUserStatRepo();
    let stats = await this.getUserStats(userId);
    if (!stats) {
      stats = await this.createUserStats(userId);
    }

    stats.total_files = Number(stats.total_files) + (delta.total_files || 0);
    stats.total_size = BigInt(stats.total_size || 0) + BigInt(delta.total_size || 0);
    stats.total_uploads = Number(stats.total_uploads) + (delta.total_uploads || 0);
    stats.total_downloads = Number(stats.total_downloads) + (delta.total_downloads || 0);

    return repo.save(stats);
  }

  async createFolderStats(folderId, userId) {
    const repo = await this.getFolderStatRepo();
    const stat = repo.create({
      id: uuidv4(),
      folder_id: folderId,
      user_id: userId,
      files_count: 0,
      total_size: 0
    });
    return repo.save(stat);
  }

  async getFolderStats(folderId) {
    const repo = await this.getFolderStatRepo();
    return repo.findOne({ where: { folder_id: folderId } });
  }

  async getBotUsageStats(botId) {
    const repo = await this.getBotUsageStatRepo();
    return repo.findOne({ where: { bot_id: botId } });
  }

  async updateFolderStats(folderId, delta) {
    const repo = await this.getFolderStatRepo();
    let stats = await this.getFolderStats(folderId);
    if (!stats) {
      const folder = await folderRepository.findById(folderId);
      if (folder) {
        stats = await this.createFolderStats(folderId, folder.user_id);
      } else {
        return null;
      }
    }

    stats.files_count = Number(stats.files_count) + (delta.files_count || 0);
    stats.total_size = BigInt(stats.total_size || 0) + BigInt(delta.total_size || 0);

    return repo.save(stats);
  }

  async getFileStats(fileId) {
    const repo = await this.getFileStatRepo();
    return repo.findOne({ where: { file_id: fileId } });
  }

  async incrementFileDownload(fileId, userId) {
    const repo = await this.getFileStatRepo();
    let stats = await this.getFileStats(fileId);
    if (!stats) {
      stats = await this.createFileStats(fileId, userId);
    }
    stats.download_count = Number(stats.download_count) + 1;
    await repo.save(stats);

    // Also update user's total downloads
    await this.updateUserStats(userId, { total_downloads: 1 });
  }

  async incrementFileView(fileId, userId) {
    const repo = await this.getFileStatRepo();
    let stats = await this.getFileStats(fileId);
    if (!stats) {
      stats = await this.createFileStats(fileId, userId);
    }
    stats.view_count = Number(stats.view_count) + 1;
    await repo.save(stats);
  }

  async createFileStats(fileId, userId) {
    const repo = await this.getFileStatRepo();
    const stat = repo.create({
      id: uuidv4(),
      file_id: fileId,
      user_id: userId,
      download_count: 0,
      view_count: 0
    });
    return repo.save(stat);
  }

  async updateBotUsageStats(botId, userId, delta) {
    const repo = await this.getBotUsageStatRepo();
    let stats = await repo.findOne({
      where: { bot_id: botId, user_id: userId }
    });

    if (!stats) {
      stats = repo.create({
        id: uuidv4(),
        bot_id: botId,
        user_id: userId,
        files_count: 0,
        total_size: 0,
        uploads_count: 0
      });
    }

    stats.files_count = Number(stats.files_count) + (delta.files_count || 0);
    stats.total_size = BigInt(stats.total_size || 0) + BigInt(delta.total_size || 0);
    stats.uploads_count = Number(stats.uploads_count) + (delta.uploads_count || 0);

    return repo.save(stats);
  }
}

export const statsService = new StatsService();
