import { BaseRepository } from "./BaseRepository.js";
import { Setting } from "../entities/Setting.js";

export class SettingRepository extends BaseRepository {
  constructor() {
    super(Setting);
  }

  async getSettings() {
    const settings = await this.find();
    // Assuming single row for global settings based on lib/db.js
    return settings[0] || null;
  }

  async isSetupComplete() {
    const settings = await this.getSettings();
    return !!settings?.setup_complete;
  }

  async saveSettings(botToken, tgUserId) {
    const settings = await this.getSettings();
    if (!settings) {
      const repo = await this.getRepository();
      const newSettings = repo.create({
        id: 1,  // Singleton: always use id 1 for global settings
        telegram_bot_token: botToken,
        telegram_user_id: tgUserId,
        setup_complete: true
      });
      return repo.save(newSettings);
    } else {
      return this.update(settings.id, {
        telegram_bot_token: botToken,
        telegram_user_id: tgUserId,
        setup_complete: true,
        updated_at: new Date()
      });
    }
  }

  async updateSettings(data) {
    const settings = await this.getSettings();
    if (settings) {
      return this.update(settings.id, data);
    } else {
      return null;
    }
  }
}

export const settingRepository = new SettingRepository();
