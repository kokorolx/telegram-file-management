import { getDataSource } from "../data-source.js";

export class BaseRepository {
  constructor(entity) {
    this.entity = entity;
  }

  async getRepository() {
    const dataSource = await getDataSource();
    return dataSource.getRepository(this.entity);
  }

  async find(options) {
    const repo = await this.getRepository();
    return repo.find(options);
  }

  async findOne(options) {
    const repo = await this.getRepository();
    return repo.findOne(options);
  }

  async save(data) {
    const repo = await this.getRepository();
    return repo.save(data);
  }

  async update(id, data) {
    const repo = await this.getRepository();
    return repo.update(id, data);
  }

  async delete(id) {
    const repo = await this.getRepository();
    return repo.delete(id);
  }
}
