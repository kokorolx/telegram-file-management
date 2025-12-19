import { BaseRepository } from "./BaseRepository.js";
import { Folder } from "../entities/Folder.js";
import { IsNull } from "typeorm";

export class FolderRepository extends BaseRepository {
  constructor() {
    super(Folder);
  }

  async findByUserAndParent(userId, parentId = null) {
    return this.find({
      where: {
        user_id: userId,
        parent_id: parentId === null ? IsNull() : parentId,
      },
      order: { name: "ASC" },
    });
  }

  async findByUserId(userId) {
    return this.find({
      where: { user_id: userId },
      order: { name: "ASC" },
    });
  }

  async findById(id) {
    return this.findOne({ where: { id } });
  }

  async findBySlugAndParent(userId, slug, parentId = null) {
    return this.findOne({
      where: {
        user_id: userId,
        slug: slug,
        parent_id: parentId === null ? IsNull() : parentId,
      }
    });
  }

  async findByPath(userId, pathStr) {
    if (!pathStr || pathStr === '/' || pathStr.trim() === '') {
      return null;
    }

    const slugs = pathStr.split('/').filter(p => p.length > 0);
    let currentParentId = null;
    let currentFolder = null;

    for (const slug of slugs) {
      currentFolder = await this.findBySlugAndParent(userId, slug, currentParentId);
      if (!currentFolder) return null;
      currentParentId = currentFolder.id;
    }

    return currentFolder;
  }
}

export const folderRepository = new FolderRepository();
