import { BaseRepository } from "./BaseRepository.js";
import { File } from "../entities/File.js";
import { IsNull } from "typeorm";

export class FileRepository extends BaseRepository {
  constructor() {
    super(File);
  }

  async findByUserId(userId) {
    return this.find({
      where: { user_id: userId },
      order: { uploaded_at: "DESC" },
    });
  }

  async findByUserAndFolder(userId, folderId = null) {
    return this.find({
      where: {
        user_id: userId,
        folder_id: folderId === null ? IsNull() : folderId,
      },
      order: { uploaded_at: "DESC" },
    });
  }

  async findById(id) {
    return this.findOne({ where: { id } });
  }

  // Resumable upload support
  async findByUserFilenameSize(userId, filename, size) {
    try {
      const result = await this.find({
        where: {
          user_id: userId,
          original_filename: filename,
          file_size: size,
          is_complete: false
        },
        order: { uploaded_at: "DESC" },
      });
      return result[0] || null;
    } catch (err) {
      console.error('Error finding resumable file:', err);
      return null;
    }
  }

  async markComplete(fileId) {
    try {
      const repo = await this.getRepository();
      await repo.update(
        { id: fileId },
        { is_complete: true, updated_at: new Date() }
      );
    } catch (err) {
      console.error('Error marking file complete:', err);
      throw err;
    }
  }

  async saveChunkPlan(fileId, chunkSizes) {
    try {
      const repo = await this.getRepository();
      await repo.update(
        { id: fileId },
        { chunk_sizes: chunkSizes }
      );
    } catch (err) {
      console.error('Error saving chunk plan:', err);
      throw err;
    }
  }

  async getChunkPlan(fileId) {
    try {
      const file = await this.findOne({ where: { id: fileId } });
      return file?.chunk_sizes || null;
    } catch (err) {
      console.error('Error getting chunk plan:', err);
      return null;
    }
  }
}

export const fileRepository = new FileRepository();
