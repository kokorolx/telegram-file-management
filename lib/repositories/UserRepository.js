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

  async updateS3Config(userId, encryptedConfig, iv, authTag) {
    const repo = await this.getRepository();
    return repo.update(userId, {
      encrypted_s3_config: encryptedConfig,
      s3_config_iv: iv,
      s3_config_tag: authTag,
      updated_at: new Date()
    });
  }

  async getS3Config(userId) {
    const user = await this.findById(userId);
    if (!user || !user.encrypted_s3_config) return null;
    return {
      encryptedData: user.encrypted_s3_config,
      iv: user.s3_config_iv,
      authTag: user.s3_config_tag,
    };
  }
}

export const userRepository = new UserRepository();
