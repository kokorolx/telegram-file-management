import { NextResponse } from 'next/server';

/**
 * DEPRECATED: GET /api/chunk?file_id=XXX&part=N
 * 
 * This endpoint is deprecated. Use the path-based endpoint instead:
 * GET /api/chunk/[fileId]/[partNumber]
 */
export async function GET(request) {
  return NextResponse.json(
    { 
      error: 'This endpoint is deprecated. Use /api/chunk/[fileId]/[partNumber] instead.',
      example: '/api/chunk/bee69593-a0b0-4f79-9688-7a20f5032717/1'
    },
    { status: 410 } // Gone
  );
}
