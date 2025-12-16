import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN not found in .env.local');
  process.exit(1);
}

const bot = new Telegraf(token);

console.log('🤖 Telegram Bot User ID Finder');
console.log('--------------------------------');
console.log('Starting bot... Send any message to @' + token.split(':')[0] + ' or reply to this message.');
console.log('');
console.log('Waiting for messages (Ctrl+C to exit)...\n');

bot.on('message', (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'N/A';
  
  console.log('\n✅ Found your user ID!');
  console.log(`   User ID: ${userId}`);
  console.log(`   Username: @${username}`);
  console.log('\nAdd this to your .env.local:');
  console.log(`   TELEGRAM_USER_ID=${userId}`);
  console.log('\n');
  
  process.exit(0);
});

bot.launch().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
