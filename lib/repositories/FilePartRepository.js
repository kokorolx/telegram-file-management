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
}

export const filePartRepository = new FilePartRepository();
