import { BaseRepository } from "./BaseRepository.js";
import { User } from "../entities/User.js";

export class UserRepository extends BaseRepository {
  constructor() {
    super(User);
  }

  async findByUsername(username) {
    return this.findOne({ where: { username } });
  }

  async findById(id) {
    return this.findOne({ where: { id } });
  }

  async updateMasterPassword(userId, hash, salt) {
    const repo = await this.getRepository();
    return repo.update(userId, {
      master_password_hash: hash,
      encryption_salt: salt,
      updated_at: new Date()
    });
  }
}

export const userRepository = new UserRepository();
