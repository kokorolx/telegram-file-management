import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { userRepository } from '@/lib/repositories/UserRepository';
import { s3ConfigService } from '@/lib/services/S3ConfigService';
import { authService } from '@/lib/authService';
import { S3ConfigValidator } from '@/lib/validators/S3ConfigValidator';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/backup
 * Returns user's backup storage configuration status (not the actual credentials).
 */
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    const user = await userRepository.findById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return status only, not credentials
    return NextResponse.json({
      hasBackupConfig: !!user.encrypted_s3_config,
      organizationId: user.organization_id || null,
    });
  } catch (err) {
    console.error('Get backup config error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/settings/backup
 * Save user's backup storage configuration (encrypted with master password).
 */
export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    const body = await request.json();
    const { masterPassword, config, provider } = body;

    if (!masterPassword) {
      return NextResponse.json({ error: 'Master password is required' }, { status: 400 });
    }

    if (!config) {
      return NextResponse.json({ error: 'S3 configuration is required' }, { status: 400 });
    }

    // Validate S3 configuration
    const validation = S3ConfigValidator.validate(config, provider || 'S3');
    if (!validation.valid) {
      return NextResponse.json({ 
        error: 'Invalid S3 configuration',
        details: validation.errors 
      }, { status: 400 });
    }

    // Validate master password
    const isValid = await authService.validateMasterPassword(masterPassword, userId);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid master password' }, { status: 401 });
    }

    // Get user's encryption salt
    const user = await userRepository.findById(userId);
    const salt = user.encryption_salt;

    // Encrypt the configuration
    const encrypted = await s3ConfigService.encryptConfig(config, masterPassword, salt);

    // Save to database
    await userRepository.updateS3Config(userId, encrypted.encryptedData, encrypted.iv, encrypted.authTag);

    return NextResponse.json({ success: true, message: 'Backup configuration saved' });
  } catch (err) {
    console.error('Save backup config error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/backup
 * Remove user's backup storage configuration.
 */
export async function DELETE(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = auth.user?.id;
    await userRepository.updateS3Config(userId, null, null, null);

    return NextResponse.json({ success: true, message: 'Backup configuration removed' });
  } catch (err) {
    console.error('Delete backup config error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
