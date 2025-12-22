import { NextResponse } from 'next/server';
import { rsaKeyManager } from '@/lib/encryption/rsaKeyManager';

export const dynamic = 'force-dynamic';

/**
 * GET /api/encryption/public-key
 * 
 * Returns server's RSA public key for client to encrypt S3 config.
 * This is PUBLIC, no authentication needed.
 * 
 * Flow:
 * 1. Browser decrypts S3 config with master password
 * 2. Browser fetches this public key
 * 3. Browser encrypts S3 config with this key
 * 4. Browser sends encrypted config to server
 * 5. Server decrypts with private key (only server has it)
 */
export async function GET(request) {
  try {
    // Ensure keys are initialized
    if (!rsaKeyManager.publicKey) {
      await rsaKeyManager.init();
    }

    const publicKey = rsaKeyManager.getPublicKey();
    
    return NextResponse.json({
      public_key: publicKey,
      algorithm: 'RSA-4096',
      padding: 'OAEP-SHA256'
    });
  } catch (err) {
    console.error('Get public key error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
