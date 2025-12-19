import { v4 as uuidv4 } from 'uuid';
import { BaseRepository } from "./BaseRepository.js";
import { UserBot } from "../entities/UserBot.js";

export class UserBotRepository extends BaseRepository {
  constructor() {
    super(UserBot);
  }

  async findByUserId(userId) {
    return this.find({
      where: { user_id: userId },
      order: { created_at: "ASC" },
    });
  }

  async findByIdAndUser(id, userId) {
    return this.findOne({
      where: { id, user_id: userId },
    });
  }

  async findDefaultByUserId(userId) {
    return this.findOne({
      where: { user_id: userId, is_default: true },
    });
  }

  async findFirstByUserId(userId) {
    return this.findOne({
      where: { user_id: userId },
      order: { is_default: "DESC", created_at: "ASC" },
    });
  }

  async unsetDefaultBot(userId) {
    const repo = await this.getRepository();
    return repo.update({ user_id: userId }, { is_default: false });
  }

  async saveBot(userId, botData) {
    return this.save({
      id: uuidv4(),
      user_id: userId,
      name: botData.name,
      bot_token: botData.botToken,
      tg_user_id: botData.tgUserId,
      is_default: botData.isDefault || false
    });
  }

  async setDefaultBot(userId, botId) {
    const repo = await this.getRepository();
    await repo.update({ user_id: userId }, { is_default: false });
    return repo.update(botId, { is_default: true, updated_at: new Date() });
  }

  async deleteBot(userId, botId) {
    const repo = await this.getRepository();
    return repo.delete({ id: botId, user_id: userId });
  }

  async getNextBotForUpload(userId) {
    const repo = await this.getRepository();
    const bot = await repo.findOne({
      where: { user_id: userId },
      order: { upload_counter: "ASC", created_at: "ASC" },
    });

    if (bot) {
      bot.updated_at = new Date();
      await repo.save(bot);
    }

    return bot;
  }

  async incrementUploadCount(botId) {
    const repo = await this.getRepository();
    await repo.increment({ id: botId }, "upload_counter", 1);
  }
}

export const userBotRepository = new UserBotRepository();
