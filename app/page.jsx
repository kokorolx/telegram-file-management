'use client';

import { useState, useEffect } from 'react';
import FileList from './components/FileList';
import UploadForm from './components/UploadForm';
import SetupModal from './components/SetupModal';
import FolderNav from './components/FolderNav';
import Breadcrumb from './components/Breadcrumb';
import CreateFolderDialog from './components/CreateFolderDialog';
import DropZone from './components/DropZone';
import SettingsDialog from './components/SettingsDialog';
import LoginDialog from './components/LoginDialog';

export default function Home() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolderInfo, setCurrentFolderInfo] = useState(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchFiles();
  }, [currentPage, debouncedSearch, currentFolderId, refreshTrigger]);

  async function fetchFiles() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('limit', 20);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (currentFolderId) params.set('folder_id', currentFolderId);

      const response = await fetch(`/api/files?${params}`);

      // Handle Authentication Error
      if (response.status === 401) {
          setShowLogin(true);
          setLoading(false);
          return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch files');
      }

      setFiles(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);

      // Fetch subfolders for current folder
      await fetchFolders();

      // If in a folder, fetch folder info for breadcrumb
      if (currentFolderId) {
        await fetchFolderInfo(currentFolderId);
      } else {
        setCurrentFolderInfo(null);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchFolders() {
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.set('parent_id', currentFolderId);

      const response = await fetch(`/api/folders?${params}`);

      if (response.status === 401) return; // Handled by fetchFiles usually

      const data = await response.json();

      if (response.ok) {
        setFolders(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  }

  async function fetchFolderInfo(folderId) {
    try {
      const response = await fetch(`/api/folders/${folderId}`);
      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setCurrentFolderInfo(data.data);
      }
    } catch (err) {
      console.error('Error fetching folder info:', err);
    }
  }

  const handleFileUploaded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFileDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSetupComplete = () => {
    fetchFiles();
  };

  const handleLoginSuccess = () => {
      setShowLogin(false);
      fetchFiles();
  };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    const menuItems = [];

    if (type === 'folder') {
      menuItems.push({
        label: 'Open',
        icon: '📂',
        onClick: () => {
          setCurrentFolderId(item.id);
          setCurrentPage(1);
          setSearchTerm('');
        }
      });
      menuItems.push({ type: 'divider' });
      menuItems.push({
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          if (!confirm(`Delete folder "${item.name}"?`)) return;
          try {
             await fetch(`/api/folders/${item.id}`, { method: 'DELETE' });
             setRefreshTrigger(prev => prev + 1);
          } catch (e) { console.error(e); }
        }
      });
    } else if (type === 'file') {
      const isPreviewable = item.mime_type?.startsWith('image/') ||
                            item.mime_type?.startsWith('video/') ||
                            item.mime_type?.startsWith('audio/');

      /* Note: Preview trigger is handled inside components usually,
         but we could implement a global preview state if needed.
         For now skipping Preview in context menu or just downloading. */

      menuItems.push({
        label: 'Download',
        icon: '⬇️',
        onClick: () => {
            const a = document.createElement('a');
            a.href = `/api/download?file_id=${item.id}`;
            a.download = item.original_filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
      });
      menuItems.push({
        label: 'Delete',
        icon: '🗑️',
        danger: true,
        onClick: async () => {
          if (!confirm(`Delete file "${item.original_filename}"?`)) return;
          try {
             await fetch(`/api/files/${item.id}`, { method: 'DELETE' });
             setRefreshTrigger(prev => prev + 1);
          } catch (e) { console.error(e); }
        }
      });
    }

    setContextMenu({ x: e.clientX, y: e.clientY, items: menuItems });
  };

  const handleItemMove = async (type, itemId, targetFolderId) => {
    try {
        let endpoint = '';
        let body = {};

        if (type === 'file') {
            endpoint = `/api/files/${itemId}`;
            body = { folder_id: targetFolderId };
        } else if (type === 'folder') {
            endpoint = `/api/folders/${itemId}`;
            body = { parent_id: targetFolderId };
        } else {
            return;
        }

        const response = await fetch(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error('Failed to move item');
        }

        // Refresh list
        setRefreshTrigger(prev => prev + 1);
    } catch (err) {
        console.error('Move error:', err);
        alert('Failed to move item');
    }
  };

  return (
    <DropZone onFilesDropped={(files) => setDroppedFiles(files)}>
      <LoginDialog
        isOpen={showLogin}
        onLoginSuccess={handleLoginSuccess}
      />
      <SetupModal onSetupComplete={handleSetupComplete} />
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
      <CreateFolderDialog
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreated={() => {
          fetchFolders();
          setRefreshTrigger(prev => prev + 1);
        }}
        parentId={currentFolderId}
        parentName={currentFolderInfo?.name}
      />
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 container-custom mx-auto py-6">
        {/* Folder Navigation Sidebar */}
        <aside className="xl:col-span-1">
          <FolderNav
            currentFolderId={currentFolderId}
            onFolderSelect={(folderId) => {
              setCurrentFolderId(folderId);
              setCurrentPage(1);
              setSearchTerm('');
            }}
          />
        </aside>

        {/* Main Content */}
        <main className="xl:col-span-3 space-y-6">
          {/* Breadcrumb & Settings Toggle */}
          <div className="flex items-center gap-4">
             <div className="flex-1">
                <Breadcrumb
                    currentFolderId={currentFolderId}
                    currentFolderInfo={currentFolderInfo}
                    onNavigate={(folderId) => {
                      setCurrentFolderId(folderId);
                      setCurrentPage(1);
                      setSearchTerm('');
                    }}
                />
             </div>
             <button
                onClick={() => setShowSettings(true)}
                title="Security Settings"
                className="p-2 rounded-lg bg-white/50 hover:bg-white text-gray-600 hover:text-blue-600 transition-colors"
             >
                <span className="text-xl">🛡️</span>
             </button>
          </div>

          {/* Upload Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>📤</span>
                  Upload File
                </h2>
                <p className="text-xs text-gray-600 mt-1">Add new files to {currentFolderInfo ? `"${currentFolderInfo.name}"` : 'your storage'}</p>
              </div>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-200 px-4 py-2 rounded-lg text-sm font-medium shadow-sm hover:shadow transition-all flex items-center gap-2"
              >
                <span className="text-lg leading-none">+</span> New Folder
              </button>
            </div>
            <UploadForm
                onFileUploaded={handleFileUploaded}
                currentFolderId={currentFolderId}
                externalFiles={droppedFiles}
            />
          </section>

          {/* Files Section */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>📚</span>
                {currentFolderInfo ? currentFolderInfo.name : 'My Files'}
              </h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-3">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <span>Error: {error}</span>
              </div>
            )}

            {/* Search Bar */}
            <div>
              <input
                type="text"
                placeholder="Search files by name, description, or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium text-sm"
              />
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <p className="text-3xl mb-2">⏳</p>
                <p className="font-medium">Loading files and folders...</p>
              </div>
            ) : folders.length === 0 && files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <p className="text-4xl mb-3">📭</p>
                <p className="font-medium text-center">
                  {searchTerm ? 'No files match your search.' : 'No files or folders yet.'}
                </p>
                <p className="text-sm mt-1">
                  {searchTerm ? 'Try a different search term.' : 'Upload a file to get started.'}
                </p>
              </div>
            ) : (
              <>
                <FileList
                  folders={folders}
                  files={files}
                  onFileDeleted={handleFileDeleted}
                  onFolderDoubleClick={(folderId) => {
                    setCurrentFolderId(folderId);
                    setCurrentPage(1);
                    setSearchTerm('');
                  }}
                  onFolderCreated={handleFileUploaded}
                  onItemContextMenu={handleContextMenu}
                />

                {files.length > 0 && (
                  <>
                    {/* Pagination */}
                    <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-sm text-gray-600 font-medium">
                        Page <span className="font-semibold text-gray-900">{currentPage}</span> of{' '}
                        <span className="font-semibold text-gray-900">{totalPages}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                          disabled={currentPage === 1 || loading}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors font-medium text-sm flex items-center gap-1"
                        >
                          ← Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages || loading}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors font-medium text-sm flex items-center gap-1"
                        >
                          Next →
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </DropZone>
  );
}
