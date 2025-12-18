import { NextResponse } from 'next/server';
import { saveSettings, getSettings, updateUserMasterPasswordHash, getUserById, saveUserSettings, addBotToUser } from '@/lib/db';
import { getUserFromRequest } from '@/lib/apiAuth';

const SETUP_TOKEN = process.env.SETUP_TOKEN || 'default-setup-token';

export async function POST(request) {
  try {
    const { botToken, userId, setupToken, useDefault, masterPassword } = await request.json();

    // Validate setup token ONLY if not using default
    // Rationale: If using default, we rely on server env which is already secure access.
    // However, to prevent random resets, we might still want it?
    // User asked "Why do we need setup token?".
    // Answer: To secure the /api/settings endpoint so random people can't overwrite your bot config.
    // BUT if `useDefault` is true, we are just telling it to use what's already in the .env.
    // Is that destructive? Yes, it overwrites DB.
    // But if .env is set, it's the source of truth anyway.
    // Let's relax the requirement for `useDefault` flow to simplify UX as requested.

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

    // Validate inputs
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

    // Save settings
    await saveSettings(finalBotToken, finalUserId);

    // Generate a unique salt for this user's encryption
    const { randomBytes } = await import('crypto');
    const encryptionSalt = randomBytes(16).toString('hex');

    // Save Master Password to USER
    const { setMasterPassword, encryptSystemData } = await import('@/lib/authService');
    const hash = await setMasterPassword(masterPassword);
    await updateUserMasterPasswordHash(user.id, hash, encryptionSalt);

    // Also save per-user encrypted telegram settings (primary bot)
    await addBotToUser(user.id, {
        name: 'Primary Bot',
        botToken: encryptSystemData(finalBotToken),
        tgUserId: encryptSystemData(finalUserId)
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

export async function GET(request) {
  try {
    // Check if setup is complete (don't expose actual values)
    const settings = await getSettings();
    const user = getUserFromRequest(request);

    let hasMasterPassword = false;
    let encryptionSalt = null;
    if (user?.id) {
        const userRecord = await getUserById(user.id);
        hasMasterPassword = !!userRecord?.master_password_hash;
        encryptionSalt = userRecord?.encryption_salt;
    }

    return NextResponse.json({
      success: true,
      setupComplete: !!settings?.telegram_bot_token && !!settings?.telegram_user_id,
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

export async function PUT(request) {
  try {
    const body = await request.json();
    const { masterPassword, setupToken, botToken, userId: tgUserId } = body;

    const user = getUserFromRequest(request);
    if (!user || !user.id) {
        return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    // Check if user already has a master password
    const userRecord = await getUserById(user.id);
    const hasExistingMaster = !!userRecord?.master_password_hash;

    // Validate setup token ONLY if they are trying to CHANGE an existing master password
    if (hasExistingMaster && setupToken !== SETUP_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Setup token is required to update an existing master password' },
        { status: 401 }
      );
    }

    if (!masterPassword) {
      return NextResponse.json(
        { success: false, error: 'Master password is required' },
        { status: 400 }
      );
    }

    // Hash and save
    // Actually authService.setMasterPassword currently returns hash, doesn't save?
    // Let's check authService.js again.
    // It returns hash. We need to save it.
    // Wait, authService.setMasterPassword calls bcrypt but I didn't implement save helper inside it?
    // I put a comment "I will have to add updateMasterPasswordHash to db.js".
    // I did add `updateMasterPasswordHash` to `db.js`.
    // So I should use the db function.

    // Let's use bcrypt directly here or use authService?
    // authService.setMasterPassword(password) returns hash.
    // implementation in authService.js:
    /*
    export async function setMasterPassword(password, botToken, userId) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    }
    */
    // It accepts botToken etc which are unused.

    // Correct usage handled above (user already fetched)
    // Move on to generation...

    // Generate a unique salt for this user's encryption
    const { randomBytes } = await import('crypto');
    const encryptionSalt = randomBytes(16).toString('hex');

    const { setMasterPassword, encryptSystemData } = await import('@/lib/authService');
    const hash = await setMasterPassword(masterPassword);

    await updateUserMasterPasswordHash(user.id, hash, encryptionSalt);

    // If they provided botToken/userId, save them too (encrypted)
    if (botToken && tgUserId) {
        await addBotToUser(user.id, {
            name: 'Primary Bot',
            botToken: encryptSystemData(botToken),
            tgUserId: encryptSystemData(tgUserId)
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
