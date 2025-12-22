import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getLatestChangelogHTML, getAllVersions } from '@/lib/changelogParser';

export const dynamic = 'force-dynamic';

/**
 * GET /api/changelog
 * 
 * Returns the latest changelog entry from PUBLIC_CHANGELOG.md
 * 
 * Response:
 * {
 *   "version": "December 22, 2025",
 *   "html": "<h2>...html content...</h2>",
 *   "allVersions": [
 *     { "version": "December 22, 2025", "title": "Recovery Code System (Coming Soon)" },
 *     ...
 *   ]
 * }
 */
export async function GET() {
  try {
    // Read PUBLIC_CHANGELOG.md
    const changelogPath = join(process.cwd(), 'PUBLIC_CHANGELOG.md');
    const markdown = readFileSync(changelogPath, 'utf-8');

    // Extract latest version
    const { version, html } = getLatestChangelogHTML(markdown);
    const allVersions = getAllVersions(markdown);

    if (!version || !html) {
      return NextResponse.json(
        { success: false, error: 'No changelog found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      version,
      html,
      allVersions
    });
  } catch (error) {
    console.error('[API] Changelog retrieval error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve changelog' },
      { status: 500 }
    );
  }
}
