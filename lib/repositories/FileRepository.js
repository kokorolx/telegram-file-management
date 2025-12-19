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
}

export const fileRepository = new FileRepository();
