import { readFileSync } from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Serve the user-friendly PUBLIC_CHANGELOG instead of technical CHANGELOG
    const changelogPath = path.join(process.cwd(), 'PUBLIC_CHANGELOG.md');
    const content = readFileSync(changelogPath, 'utf-8');

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Failed to read PUBLIC_CHANGELOG.md:', error);
    return new Response('Failed to load changelog', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
