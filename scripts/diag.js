
import { userRepository } from '../lib/repositories/UserRepository.js';
import { userBotRepository } from '../lib/repositories/UserBotRepository.js';
import { settingRepository } from '../lib/repositories/SettingRepository.js';
import { authService } from '../lib/authService.js';
import { getDataSource } from '../lib/data-source.js';

async function testToken(token, label) {
  if (!token) {
    console.log(`  [${label}] Token is missing`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok) {
      console.log(`  [${label}] ✓ Valid: @${data.result.username}`);
    } else {
      console.log(`  [${label}] ✗ Invalid: ${data.description}`);
    }
  } catch (err) {
    console.log(`  [${label}] ✗ Error: ${err.message}`);
  }
}

async function checkConfig() {
  try {
    const dataSource = await getDataSource();
    console.log('--- Testing Tokens ---');

    console.log('\nEnvironment Fallback:');
    await testToken(process.env.TELEGRAM_BOT_TOKEN, 'ENV');

    console.log('\nGlobal Settings:');
    const settings = await settingRepository.getSettings();
    if (settings) {
      await testToken(settings.telegram_bot_token, 'GLOBAL');
    }

    console.log('\nUser Specific Bots:');
    const users = await userRepository.find();
    for (const user of users) {
      const bot = await userBotRepository.findFirstByUserId(user.id);
      if (bot) {
        try {
          const decryptedToken = authService.decryptSystemData(bot.bot_token);
          await testToken(decryptedToken, `USER:${user.username}`);
        } catch (e) {
          console.log(`  [USER:${user.username}] ✗ Decryption Failed`);
        }
      }
    }

    await dataSource.destroy();
  } catch (err) {
    console.error('Diagnostic failed:', err);
    process.exit(1);
  }
}

checkConfig();
