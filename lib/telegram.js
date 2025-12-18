import { getSettings, getUserSettings } from './db.js';
import { decryptSystemData } from './authService.js';

let bot = null;
let cachedToken = null;

async function getBotToken(userId = null) {
  // Try User-specific settings first
  if (userId) {
    try {
        const userSettings = await getUserSettings(userId);
        if (userSettings?.tg_bot_token) {
            const token = decryptSystemData(userSettings.tg_bot_token);
            if (token) return token;
        }
    } catch (err) {
        console.error(`Error fetching user ${userId} bot token:`, err);
    }
  }

  // Try global database settings
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

async function getUserId(userId = null) {
  // Try User-specific settings first
  if (userId) {
     try {
         const userSettings = await getUserSettings(userId);
         if (userSettings?.tg_user_id) {
             const tid = decryptSystemData(userSettings.tg_user_id);
             if (tid) return tid;
         }
     } catch (err) {
         console.error(`Error fetching user ${userId} ID:`, err);
     }
  }

  // Try global database settings
  try {
    const settings = await getSettings();
    if (settings?.telegram_user_id) {
      return settings.telegram_user_id;
    }
  } catch (err) {
    // Fall back to env variable
  }

  // Fall back to environment variable
  const targetId = process.env.TELEGRAM_USER_ID;
  if (!targetId) {
    throw new Error('TELEGRAM_USER_ID not configured. Please complete setup at /setup');
  }
  return targetId;
}

async function getBot() {
  if (!bot) {
    const token = await getBotToken();
    bot = new Telegraf(token);
  }
  return bot;
}

/**
 * Retry fetch with exponential backoff
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const { timeout = 30000, ...fetchOptions } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let timeoutId;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const isLastAttempt = attempt === maxRetries;

      if (isLastAttempt) throw error;

      // Exponential backoff: 1s, 2s, 4s
      const delayMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(`Telegram fetch attempt ${attempt} failed, retrying in ${delayMs}ms:`, error.message);

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export async function sendFileToTelegram(userId, fileBuffer, filename) {
  const startTime = Date.now();

  try {
    console.log(`[TELEGRAM] Sending file to Telegram: ${filename} (${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB)`);

    const token = await getBotToken(userId);
    const chatId = await getUserId(userId);

    // Send document to Telegram using the API directly for buffer support
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('document', new Blob([fileBuffer], { type: 'application/octet-stream' }), filename);
    formData.append('caption', `File: ${filename}`);

    console.log(`[TELEGRAM] Making API request (timeout: 30s, retries: 3)...`);

    const response = await fetchWithRetry(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
      timeout: 30000,
    }, 3);

    if (!response.ok) {
      const error = await response.json();
      console.error(`[TELEGRAM] ✗ API error: ${error.description}`);
      throw new Error(error.description || 'Failed to send document');
    }

    const data = await response.json();

    if (!data.ok) {
      console.error(`[TELEGRAM] ✗ Response error: ${data.description}`);
      throw new Error(data.description || 'Telegram API error');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileId = data.result.document.file_id;
    console.log(`[TELEGRAM] ✓ File uploaded successfully (${duration}s) - File ID: ${fileId.substring(0, 20)}...`);

    // Return the file_id that Telegram assigns
    return fileId;
  } catch (error) {
    console.error(`[TELEGRAM] ✗ Upload failed: ${error.message}`);
    throw new Error(`Failed to upload file to Telegram: ${error.message}`);
  }
}

export async function getFileDownloadUrl(userId, fileId) {
  try {
    const token = await getBotToken(userId);

    // Get file info from Telegram with retry
    const response = await fetchWithRetry(
      `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`,
      { timeout: 30000 },
      3
    );
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
