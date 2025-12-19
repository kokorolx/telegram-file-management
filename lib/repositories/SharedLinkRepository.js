import { BaseRepository } from "./BaseRepository.js";
import { SharedLink } from "../entities/SharedLink.js";

export class SharedLinkRepository extends BaseRepository {
  constructor() {
    super(SharedLink);
  }

  async findByToken(token) {
    return this.findOne({
      where: { token },
      relations: ["file", "file.parts"]
    });
  }

  async findByUserId(userId) {
    return this.find({
      where: { user_id: userId },
      order: { created_at: "DESC" },
      relations: ["file"]
    });
  }

  async incrementViews(id) {
    await this.update(id, {
      views: () => "views + 1"
    });
  }

  async incrementDownloads(id) {
    await this.update(id, {
      downloads: () => "downloads + 1"
    });
  }
}

export const sharedLinkRepository = new SharedLinkRepository();
