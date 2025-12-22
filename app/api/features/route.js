import { NextResponse } from 'next/server';
import { isRecoveryCodesEnabled, isRecoveryCodesBeta, getRecoveryCodesRolloutPercent } from '@/lib/featureFlags';

export const dynamic = 'force-dynamic';

/**
 * GET /api/features
 * 
 * Returns feature flag status for client-side consumption
 * 
 * Response:
 * {
 *   "recoveryCodesEnabled": true,
 *   "recoveryCodesBeta": false,
 *   "recoveryCodesRolloutPercent": 0
 * }
 */
export async function GET() {
  try {
    return NextResponse.json({
      recoveryCodesEnabled: isRecoveryCodesEnabled(),
      recoveryCodesBeta: isRecoveryCodesBeta(),
      recoveryCodesRolloutPercent: getRecoveryCodesRolloutPercent()
    });
  } catch (error) {
    console.error('[API] Feature flags retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve feature flags' },
      { status: 500 }
    );
  }
}
