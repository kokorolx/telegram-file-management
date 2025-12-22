import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { S3Client, ListBucketsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/backup/test
 * Tests S3 credentials and optionally verifies a bucket or lists available buckets.
 */
export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { endpoint, region, accessKeyId, secretAccessKey, bucket } = body;

    if (!accessKeyId || !secretAccessKey) {
      return NextResponse.json({ error: 'Access Key and Secret Key are required' }, { status: 400 });
    }

    const clientConfig = {
      region: region || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };

    if (endpoint) {
      // Ensure endpoint has protocol
      let finalEndpoint = endpoint;
      if (!finalEndpoint.startsWith('http')) {
        finalEndpoint = `https://${finalEndpoint}`;
      }
      clientConfig.endpoint = finalEndpoint;
      clientConfig.forcePathStyle = true;
    }

    const client = new S3Client(clientConfig);

    try {
      if (bucket) {
        // Test connectivity to a specific bucket
        const command = new HeadBucketCommand({ Bucket: bucket });
        await client.send(command);
        return NextResponse.json({
          success: true,
          message: `Successfully connected to bucket "${bucket}"`
        });
      } else {
        // List buckets to verify credentials
        const command = new ListBucketsCommand({});
        const data = await client.send(command);
        return NextResponse.json({
          success: true,
          message: 'Credentials verified',
          buckets: data.Buckets?.map(b => b.Name) || []
        });
      }
    } catch (s3Err) {
      console.error('[S3 Test] S3 Error:', s3Err);

      // Friendly messages for common errors
      let errorMsg = s3Err.message;
      if (s3Err.name === 'InvalidAccessKeyId') errorMsg = 'Invalid Access Key ID';
      if (s3Err.name === 'SignatureDoesNotMatch') errorMsg = 'Invalid Secret Access Key';
      if (s3Err.name === 'NoSuchBucket') errorMsg = 'Bucket does not exist';
      if (s3Err.name === 'AccessDenied') errorMsg = 'Access Denied (Check your IAM permissions)';

      return NextResponse.json({
        success: false,
        error: errorMsg,
        code: s3Err.name
      }, { status: 400 });
    }
  } catch (err) {
    console.error('[S3 Test] Server Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
