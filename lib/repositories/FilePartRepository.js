import { BaseRepository } from "./BaseRepository.js";
import { FilePart } from "../entities/FilePart.js";

export class FilePartRepository extends BaseRepository {
  constructor() {
    super(FilePart);
  }

  async findByFileId(fileId) {
    return this.find({
      where: { file_id: fileId },
      order: { part_number: "ASC" },
    });
  }

  async countByBotId(botId) {
    const repo = await this.getRepository();
    return repo.count({ where: { bot_id: botId } });
  }

  // Resumable upload support
  async findByFileIdAndPart(fileId, partNumber) {
    try {
      const result = await this.findOne({
        where: { file_id: fileId, part_number: partNumber }
      });
      return result || null;
    } catch (err) {
      console.error('Error finding file part:', err);
      return null;
    }
  }

  async getUploadedPartNumbers(fileId) {
    try {
      const result = await this.find({
        where: { file_id: fileId },
        order: { part_number: "ASC" }
      });
      return result.map(r => r.part_number);
    } catch (err) {
      console.error('Error getting uploaded parts:', err);
      return [];
    }
  }
}

export const filePartRepository = new FilePartRepository();
