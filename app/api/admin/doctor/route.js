import { NextResponse } from 'next/server';
import { healthService } from '../../../../lib/services/HealthService';
import { config } from '../../../../lib/config';

// NOTE: In a production app, this route should be protected by middleware or requireAuth
export async function GET() {
  try {
    const report = await healthService.getSystemCapabilities();

    return NextResponse.json({
      status: report.health.database === 'UP' && report.health.redis === 'UP' ? 'HEALHY' : 'DEGRADED',
      environment: {
        is_enterprise: config.isEnterprise,
        storage_backend: config.storageBackend,
      },
      diagnostics: report
    });
  } catch (error) {
    return NextResponse.json({
      status: 'CRITICAL',
      error: error.message
    }, { status: 500 });
  }
}
