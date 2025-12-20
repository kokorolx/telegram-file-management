
import { settingRepository } from './lib/repositories/SettingRepository.js';
import { getDataSource } from './lib/data-source.js';

async function fixConfig() {
  try {
    const dataSource = await getDataSource();
    console.log('--- Fixing Config ---');

    const settings = await settingRepository.getSettings();
    if (settings) {
      console.log(`Current Global Token: ${settings.telegram_bot_token ? settings.telegram_bot_token.substring(0, 5) + '...' : 'NULL'}`);

      // Clear the global token so it falls back to ENV
      await settingRepository.updateSettings({ telegram_bot_token: null });
      console.log('✓ Global bot token cleared in database. System will now fall back to TELEGRAM_BOT_TOKEN from environment.');
    } else {
      console.log('No global settings found.');
    }

    await dataSource.destroy();
  } catch (err) {
    console.error('Fix failed:', err);
    process.exit(1);
  }
}

fixConfig();
