import { NextResponse } from 'next/server';
import { settingRepository } from '@/lib/repositories/SettingRepository';
import { userRepository } from '@/lib/repositories/UserRepository';
import { userBotRepository } from '@/lib/repositories/UserBotRepository';
import { authService } from '@/lib/authService';
import { getUserFromRequest } from '@/lib/apiAuth';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

const SETUP_TOKEN = process.env.SETUP_TOKEN || 'default-setup-token';

/**
 * POST /api/settings
 * Initial setup of global settings and master password.
 */
export async function POST(request) {
  try {
    const { botToken, userId, setupToken, useDefault, masterPassword } = await request.json();

    if (!useDefault && setupToken !== SETUP_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Invalid setup token' },
        { status: 401 }
      );
    }

    let finalBotToken = botToken;
    let finalUserId = userId;

    if (useDefault) {
        finalBotToken = process.env.TELEGRAM_BOT_TOKEN;
        finalUserId = process.env.TELEGRAM_USER_ID;

        if (!finalBotToken || !finalUserId) {
            return NextResponse.json(
                { success: false, error: 'Server environment variables TELEGRAM_BOT_TOKEN or TELEGRAM_USER_ID are missing.' },
                { status: 500 }
            );
        }
    }

    if (!finalBotToken || !finalUserId) {
      return NextResponse.json(
        { success: false, error: 'Bot token and user ID are required' },
        { status: 400 }
      );
    }

    if (!masterPassword) {
      return NextResponse.json(
        { success: false, error: 'Master Password is required for encryption setup.' },
        { status: 400 }
      );
    }

    const user = getUserFromRequest(request);
    if (!user || !user.id) {
        return NextResponse.json(
            { success: false, error: 'Authentication required to set master password.' },
            { status: 401 }
        );
    }

    // 1. Mark setup as complete (singleton setting with id=1)
    await settingRepository.saveSettings(finalBotToken, finalUserId);

    // 2. Setup Master Password (user-specific)
    const encryptionSalt = randomBytes(16).toString('hex');
    const hash = await authService.generateMasterPasswordHash(masterPassword);
    await userRepository.updateMasterPassword(user.id, hash, encryptionSalt);

    // 3. Save primary bot to user (encrypted, per-user storage)
    // Note: Bot tokens are stored per-user in user_bots table, not in global settings
    await userBotRepository.saveBot(user.id, {
        name: 'Primary Bot',
        botToken: authService.encryptSystemData(finalBotToken),
        tgUserId: authService.encryptSystemData(finalUserId),
        isDefault: true
    });

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      salt: encryptionSalt
    });
  } catch (error) {
    console.error('Settings save error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save settings' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/settings
 * Check setup status and get user encryption salt.
 */
export async function GET(request) {
  try {
    const settings = await settingRepository.getSettings();
    const user = getUserFromRequest(request);

    let hasMasterPassword = false;
    let encryptionSalt = null;
    if (user?.id) {
        const userRecord = await userRepository.findById(user.id);
        hasMasterPassword = !!userRecord?.master_password_hash;
        encryptionSalt = userRecord?.encryption_salt;
    }

    return NextResponse.json({
      success: true,
      setupComplete: await settingRepository.isSetupComplete(),
      hasMasterPassword: hasMasterPassword,
      encryptionSalt: encryptionSalt
    });
  } catch (error) {
    console.error('Settings get error:', error);
    return NextResponse.json(
      { success: false, setupComplete: false },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings
 * Update master password and optionally secondary bot info.
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { masterPassword, setupToken, botToken, userId: tgUserId, email } = body;

    const user = getUserFromRequest(request);
    if (!user || !user.id) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const userRecord = await userRepository.findById(user.id);

    // Update email if provided
    if (email !== undefined) {
        await userRepository.update(user.id, { email });
    }

    const hasExistingMaster = !!userRecord?.master_password_hash;

    // Setup token only required for bot configuration, not for master password
    // Authenticated users can change their own master password without setup token
    if (!useDefault && setupToken !== SETUP_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Invalid setup token for bot configuration' },
        { status: 401 }
      );
    }

    if (!masterPassword) {
      return NextResponse.json(
        { success: false, error: 'Master password is required' },
        { status: 400 }
      );
    }

    const encryptionSalt = randomBytes(16).toString('hex');
    const hash = await authService.generateMasterPasswordHash(masterPassword);
    await userRepository.updateMasterPassword(user.id, hash, encryptionSalt);

    if (botToken && tgUserId) {
        await userBotRepository.saveBot(user.id, {
            name: 'Primary Bot',
            botToken: authService.encryptSystemData(botToken),
            tgUserId: authService.encryptSystemData(tgUserId)
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Master password updated successfully',
      salt: encryptionSalt
    });
  } catch (error) {
    console.error('Settings update error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}
