import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { userRepository } from '@/lib/repositories/UserRepository';

export const dynamic = 'force-dynamic';

/**
 * GET /api/upload/s3-config
 * 
 * Returns user's encrypted S3 config (encrypted with master password).
 * Browser will decrypt this with master password, then re-encrypt with
 * server's public key before sending to upload endpoint.
 * 
 * This is the intermediate step where encrypted config is fetched,
 * so browser can decrypt and re-encrypt it.
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

    // Check if user has personal S3 config
    if (!user.encrypted_s3_config) {
      return NextResponse.json({
        hasConfig: false,
        config: null
      });
    }

    // Return encrypted config (encrypted with master password)
    // Browser will decrypt this with master password
    return NextResponse.json({
      hasConfig: true,
      config: {
        encrypted_data: user.encrypted_s3_config,
        iv: user.s3_config_iv,
        auth_tag: user.s3_config_tag
      }
    });
  } catch (err) {
    console.error('Get S3 config error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
