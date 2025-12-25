import { folderRepository } from "../repositories/FolderRepository.js";
import { v4 as uuidv4 } from 'uuid';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export class FolderService {
  async createFolder(userId, name, parentId = null) {
    let baseSlug = slugify(name) || 'folder';
    let finalSlug = baseSlug;
    let counter = 1;

    // Handle Unique Slug - per user
    while (true) {
      const conflict = await folderRepository.findBySlugAndParent(userId, finalSlug, parentId);
      if (!conflict) break;
      finalSlug = `${baseSlug}-${counter++}`;
    }

    const folderId = uuidv4();
    return await folderRepository.save({
      id: folderId,
      user_id: userId,
      name,
      parent_id: parentId,
      slug: finalSlug
    });
  }

  async getFolders(userId, parentId = null) {
    return folderRepository.findByUserAndParent(userId, parentId);
  }

  async getFolderById(id) {
    return folderRepository.findById(id);
  }

  async deleteFolder(id) {
    const folder = await folderRepository.findById(id);
    if (!folder) return false;

    // 1. Move subfolders to current parent
    const subfolders = await folderRepository.find({ where: { parent_id: id } });
    for (const sub of subfolders) {
      await folderRepository.update(sub.id, { parent_id: folder.parent_id });
    }

    // 2. Move files to current parent
    const { fileRepository } = await import('../repositories/FileRepository.js');
    await fileRepository.getRepository().then(repo =>
      repo.update({ folder_id: id }, { folder_id: folder.parent_id })
    );

    // 3. Delete stats (TypeORM cascading might handle this if defined, but being explicit)
    const { statsService } = await import('./StatsService.js');
    const folderStatRepo = await statsService.getFolderStatRepo();
    await folderStatRepo.delete({ folder_id: id });

    // 4. Delete folder
    return folderRepository.delete(id);
  }

  async moveFolder(id, newParentId) {
    if (id === newParentId) throw new Error("Cannot move folder into itself");
    
    // Prevent circular references: check if newParentId is a descendant of id
    if (newParentId) {
      const isCircular = await this._isDescendant(id, newParentId);
      if (isCircular) throw new Error("Cannot move folder: would create a circular reference");
    }
    
    return folderRepository.update(id, {
      parent_id: newParentId || null,
      updated_at: new Date()
    });
  }
  
  async _isDescendant(potentialAncestorId, potentialDescendantId) {
    let current = potentialDescendantId;
    const maxDepth = 100; // Safety valve to prevent infinite loops
    let depth = 0;
    
    while (current && depth < maxDepth) {
      if (current === potentialAncestorId) return true;
      
      const folder = await folderRepository.findById(current);
      if (!folder || !folder.parent_id) break;
      
      current = folder.parent_id;
      depth++;
    }
    
    return false;
  }

  async renameFolder(id, newName) {
    const folder = await folderRepository.findById(id);
    if (!folder) throw new Error("Folder not found");

    let baseSlug = slugify(newName) || 'folder';
    let finalSlug = baseSlug;
    let counter = 1;

    while (true) {
      const conflict = await folderRepository.findBySlugAndParent(folder.user_id, finalSlug, folder.parent_id);
      if (!conflict || conflict.id === id) break;
      finalSlug = `${baseSlug}-${counter++}`;
    }

    return await folderRepository.update(id, {
      name: newName,
      slug: finalSlug,
      updated_at: new Date()
    });
  }
}

export const folderService = new FolderService();
