/**
 * Changelog Parser
 * 
 * Extracts the latest version and content from PUBLIC_CHANGELOG.md
 * Converts markdown to HTML for modal display
 */

/**
 * Parse PUBLIC_CHANGELOG.md and extract latest version
 * Format: "## [Month DD, YYYY] - Feature Description"
 * 
 * @returns {Object} { version: "Month DD, YYYY", date: Date, content: "HTML string" }
 */
export function parseLatestChangelog() {
  // This will be populated at build time via API or read from file
  // For now, return a marker that triggers the version check
  return {
    version: null,
    date: null,
    content: null
  };
}

/**
 * Extract version string from changelog header
 * Format: "[December 22, 2025]"
 * 
 * @param {string} line - Header line
 * @returns {string} Version string like "December 22, 2025"
 */
export function extractVersion(line) {
  const match = line.match(/\[([^\]]+)\]/);
  return match ? match[1] : null;
}

/**
 * Convert markdown to simple HTML for changelog modal
 * Handles: headings, lists, bold, code blocks
 * 
 * @param {string} markdown - Markdown content
 * @returns {string} HTML content
 */
export function markdownToHtml(markdown) {
  let html = markdown
    // Headers
    .replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Code inline
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">$1</code>')
    // Lists
    .replace(/^- (.*?)$/gm, '<li>$1</li>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-4" />')
    // Paragraphs
    .split('\n\n')
    .map(p => p.trim() ? `<p>${p}</p>` : '')
    .join('');

  return html;
}

/**
 * Get the latest changelog section from raw markdown
 * Extracts first version block (from first ## to second ## or end)
 * 
 * @param {string} rawMarkdown - Raw PUBLIC_CHANGELOG.md content
 * @returns {Object} { version, html }
 */
export function getLatestChangelogHTML(rawMarkdown) {
  const lines = rawMarkdown.split('\n');
  
  // Find first ## [Date] - Title line
  let startIdx = -1;
  let endIdx = lines.length;
  let version = null;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## [')) {
      if (startIdx === -1) {
        startIdx = i;
        version = extractVersion(lines[i]);
      } else {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    return { version: null, html: null };
  }

  // Extract content between first and second ## 
  const content = lines.slice(startIdx, endIdx).join('\n');
  const html = markdownToHtml(content);

  return { version, html };
}

/**
 * Get all versions from changelog
 * Useful for debugging or showing version history
 * 
 * @param {string} rawMarkdown - Raw PUBLIC_CHANGELOG.md content
 * @returns {Array} Array of { version, date }
 */
export function getAllVersions(rawMarkdown) {
  const lines = rawMarkdown.split('\n');
  const versions = [];

  for (const line of lines) {
    if (line.startsWith('## [')) {
      const version = extractVersion(line);
      if (version) {
        versions.push({
          version,
          title: line.replace(/^## \[.*?\] - /, '')
        });
      }
    }
  }

  return versions;
}

/**
 * Normalize version string for comparison
 * Converts "December 22, 2025" to comparable format
 * 
 * @param {string} versionString - Version like "December 22, 2025"
 * @returns {Date} Date object for comparison
 */
export function parseVersionDate(versionString) {
  try {
    return new Date(versionString);
  } catch (e) {
    return null;
  }
}

/**
 * Compare two version dates
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 * 
 * @param {string} v1 - Version string 1
 * @param {string} v2 - Version string 2
 * @returns {number} Comparison result
 */
export function compareVersions(v1, v2) {
  const d1 = parseVersionDate(v1);
  const d2 = parseVersionDate(v2);

  if (!d1 || !d2) return 0;

  if (d1 > d2) return 1;
  if (d1 < d2) return -1;
  return 0;
}

/**
 * Check if a new version should be shown
 * Compares current latest version with last seen version in localStorage
 * 
 * @param {string} currentVersion - Current latest version
 * @returns {boolean} True if version hasn't been seen before
 */
export function shouldShowChangelog(currentVersion) {
  if (!currentVersion || typeof window === 'undefined') {
    return false;
  }

  try {
    const lastSeen = localStorage.getItem('lastSeenChangelogVersion');
    if (!lastSeen) {
      return true; // First time seeing any changelog
    }

    return compareVersions(currentVersion, lastSeen) > 0;
  } catch (e) {
    return false; // localStorage not available
  }
}

/**
 * Mark a version as seen
 * 
 * @param {string} version - Version string to mark as seen
 */
export function markChangelogAsSeen(version) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem('lastSeenChangelogVersion', version);
  } catch (e) {
    console.error('Failed to save changelog version:', e);
  }
}
