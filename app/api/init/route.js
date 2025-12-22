import { NextResponse } from 'next/server';
import { rsaKeyManager } from '@/lib/encryption/rsaKeyManager';

export const dynamic = 'force-dynamic';

// Flag to ensure init only happens once per process
let initialized = false;

/**
 * GET /api/init
 * 
 * Initialize server-side encryption keys (RSA key pair).
 * This should be called once when the app starts.
 * 
 * Safe to call multiple times (idempotent).
 */
export async function GET(request) {
  try {
    if (!initialized) {
      await rsaKeyManager.init();
      initialized = true;
      console.log('[INIT] Server initialization complete');
    }

    return NextResponse.json({
      success: true,
      message: 'Server initialized',
      rsa_keys_ready: !!rsaKeyManager.getPublicKey()
    });
  } catch (err) {
    console.error('[INIT] Initialization failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
