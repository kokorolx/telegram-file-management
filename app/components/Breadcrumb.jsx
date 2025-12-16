'use client';

import { useEffect, useState } from 'react';

export default function Breadcrumb({ currentFolderId, currentFolderInfo, onNavigate }) {
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (!currentFolderId || !currentFolderInfo) {
      setBreadcrumbs([{ id: null, name: 'My Files' }]);
      return;
    }

    buildBreadcrumbs();
  }, [currentFolderId, currentFolderInfo]);

  async function buildBreadcrumbs() {
    try {
      const crumbs = [];
      let folderId = currentFolderId;

      // Build breadcrumb path
      while (folderId) {
        const response = await fetch(`/api/folders/${folderId}`);
        if (!response.ok) break;

        const data = await response.json();
        const folder = data.data;

        crumbs.unshift({ id: folder.id, name: folder.name });
        folderId = folder.parent_id; // Move to parent
      }

      // Add root at the beginning
      crumbs.unshift({ id: null, name: 'My Files' });
      setBreadcrumbs(crumbs);
    } catch (err) {
      console.error('Error building breadcrumbs:', err);
      setBreadcrumbs([{ id: null, name: 'My Files' }]);
    }
  }

  if (breadcrumbs.length <= 1 && !currentFolderId) {
    return null; // Don't show breadcrumb when at root
  }

  return (
    <nav className="flex items-center gap-1 text-sm bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.id || 'root'} className="flex items-center gap-1">
          <button
            onClick={() => onNavigate(crumb.id)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
              index === breadcrumbs.length - 1
                ? 'text-gray-900 bg-gray-100 cursor-default'
                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
            }`}
          >
            {crumb.name}
          </button>
          {index < breadcrumbs.length - 1 && (
            <span className="text-gray-400 px-1">/</span>
          )}
        </div>
      ))}
    </nav>
  );
}
