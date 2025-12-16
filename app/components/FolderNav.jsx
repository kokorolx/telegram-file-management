'use client';

import { useState, useEffect } from 'react';

export default function FolderNav({ currentFolderId, onFolderSelect }) {
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadFolders();
  }, []);

  async function loadFolders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/folders');
      const data = await response.json();
      if (response.ok) {
        setFolders(data.data || []);
      } else {
        setError(data.error || 'Failed to load folders');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6 sticky top-24 xl:top-24">
      <div>
        <h3 className="font-semibold text-gray-900 mb-4 text-base flex items-center gap-2">
          <span className="text-lg">📂</span>
          Folders
        </h3>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* My Files (root) */}
        <button
          onClick={() => onFolderSelect(null)}
          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors font-medium ${
            currentFolderId === null
              ? 'bg-blue-100 text-blue-900 border border-blue-200'
              : 'hover:bg-gray-100 text-gray-700 border border-transparent'
          }`}
        >
          📁 My Files
        </button>

        {/* Folder list */}
        {loading ? (
          <div className="text-center py-6 text-gray-500 text-sm">Loading folders...</div>
        ) : folders.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No folders yet</div>
        ) : (
          <div className="space-y-0">
            {folders.map((folder) => (
              <div key={folder.id}>
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => toggleFolder(folder.id)}
                    className="text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors flex-shrink-0 text-xs"
                  >
                    {expandedFolders.has(folder.id) ? '▼' : '▶'}
                  </button>
                  <button
                    onClick={() => onFolderSelect(folder.id)}
                    className={`flex-1 text-left px-2 py-2.5 rounded-lg text-sm transition-colors font-medium truncate ${
                      currentFolderId === folder.id
                        ? 'bg-blue-100 text-blue-900 border border-blue-200'
                        : 'hover:bg-gray-100 text-gray-700 border border-transparent'
                    }`}
                    title={folder.name}
                  >
                    📂 {folder.name}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
