import { Telegraf } from 'telegraf';
import { getSettings } from './db.js';

let bot = null;
let cachedToken = null;

async function getBotToken() {
  // Try database first
  try {
    const settings = await getSettings();
    if (settings?.telegram_bot_token) {
      return settings.telegram_bot_token;
    }
  } catch (err) {
    // Fall back to env variable
  }
  
  // Fall back to environment variable
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN not configured. Please complete setup at /setup');
  }
  return token;
}

async function getUserId() {
  // Try database first
  try {
    const settings = await getSettings();
    if (settings?.telegram_user_id) {
      return settings.telegram_user_id;
    }
  } catch (err) {
    // Fall back to env variable
  }
  
  // Fall back to environment variable
  const userId = process.env.TELEGRAM_USER_ID;
  if (!userId) {
    throw new Error('TELEGRAM_USER_ID not configured. Please complete setup at /setup');
  }
  return userId;
}

async function getBot() {
  if (!bot) {
    const token = await getBotToken();
    bot = new Telegraf(token);
  }
  return bot;
}

export async function sendFileToTelegram(fileBuffer, filename) {
  try {
    const token = await getBotToken();
    const chatId = await getUserId();
    
    // Send document to Telegram using the API directly for buffer support
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fileBuffer], { type: 'application/octet-stream' }), filename);
    formData.append('caption', `File: ${filename}`);
    
    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.description || 'Failed to send document');
    }
    
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }
    
    // Return the file_id that Telegram assigns
    return data.result.document.file_id;
  } catch (error) {
    console.error('Error sending file to Telegram:', error);
    throw new Error(`Failed to upload file to Telegram: ${error.message}`);
  }
}

export async function getFileDownloadUrl(fileId) {
  try {
    const token = await getBotToken();
    
    // Get file info from Telegram
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.description || 'Failed to get file');
    }
    
    // Construct the download URL
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
    
    return downloadUrl;
  } catch (error) {
    console.error('Error getting file from Telegram:', error);
    throw new Error(`Failed to get file from Telegram: ${error.message}`);
  }
}

export async function deleteFileFromTelegram(fileId) {
  try {
    // Note: Telegram Bot API doesn't support deleting files from saved messages
    // We just remove from our database, the file stays on Telegram
    console.log(`File ${fileId} marked for deletion (remains on Telegram)`);
    return true;
  } catch (error) {
    console.error('Error deleting file from Telegram:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

export { getBot };
