'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import FileList from '../components/FileList';
import UploadForm from '../components/UploadForm';
import SetupModal from '../components/SetupModal';
import FolderNav from '../components/FolderNav';
import Breadcrumb from '../components/Breadcrumb';
import CreateFolderDialog from '../components/CreateFolderDialog';
import DropZone from '../components/DropZone';
import SettingsDialog from '../components/SettingsDialog';
import LoginDialog from '../components/LoginDialog';
import ContextMenu from '../components/ContextMenu';
import Link from 'next/link';

export default function Home({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Resolve current path from params (Next.js 13+ app dir)
  // params.folderPath is array: ['folder', 'sub']
  // If undefined, we are at root.
  const folderPathSegments = params.folderPath || [];
  const currentPath = folderPathSegments.length > 0 ? '/' + folderPathSegments.join('/') : '/';

  // Local State
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true); // Initial load
  const [loadingMore, setLoadingMore] = useState(false); // Infinite scroll load
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Derived state from API
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolderInfo, setCurrentFolderInfo] = useState(null);

  // UI State
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [contextMenu, setContextMenu] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  // Reset state when path changes (Navigation)
  useEffect(() => {
     // We do NOT clear files/folders immediately to enable "soft loading" (dimmed old content)
     // setFiles([]);
     // setFolders([]);
     setPage(1);
     setHasMore(true);
     setLoading(true);
     setSearchTerm('');
  }, [currentPath]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      if (searchTerm !== debouncedSearch) {
          setPage(1);
          setFiles([]); // Clear on new search
          setHasMore(true);
          setLoading(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchFiles = useCallback(async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
          setLoadingMore(true);
      } else {
          // If not loading more, we rely on `loading` state or initial state.
      }

      setError(null);

      const params = new URLSearchParams();
      params.set('page', isLoadMore ? page : 1);
      params.set('limit', 20); // Fetch 20 at a time
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('path', currentPath);

      const response = await fetch(`/api/files?${params}`);

      if (response.status === 401) {
          setShowLogin(true);
          setLoading(false);
          setLoadingMore(false);
          return;
      }

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 404) throw new Error('Folder not found');
        throw new Error(data.error || 'Failed to fetch files');
      }

      setFiles(prev => {
          if (isLoadMore) {
              const newFiles = data.data || [];
              const existingIds = new Set(prev.map(f => f.id));
              const filteredNew = newFiles.filter(f => !existingIds.has(f.id));
              return [...prev, ...filteredNew];
          } else {
              return data.data || [];
          }
      });

      setHasMore(data.pagination?.hasMore || false);
      if (isLoadMore && data.pagination?.hasMore) {
          setPage(prev => prev + 1);
      } else if (!isLoadMore && data.pagination?.hasMore) {
           // Reset page to 2 for next load more if we just fetched page 1
           setPage(2);
      }

      if (data.metadata?.currentFolder) {
          setCurrentFolderId(data.metadata.currentFolder.id);
          setCurrentFolderInfo(data.metadata.currentFolder);
      } else {
          setCurrentFolderId(null);
          setCurrentFolderInfo(null);
      }

    } catch (err) {
      setError(err.message);
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedSearch, currentPath, page]);

  // Initial Fetch & Refresh
  useEffect(() => {
    fetchFiles(false);
  }, [refreshTrigger, currentPath, debouncedSearch]);

  // Intersection Observer for Infinite Scroll
  const observerTarget = useCallback(node => {
      if (loading || loadingMore) return;
      if (!hasMore) return;

      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
           fetchFiles(true);
        }
      });

      if (node) observer.observe(node);
      return () => {
          if (node) observer.unobserve(node);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loadingMore, hasMore, fetchFiles]);

  // Fetch subfolders whenever currentFolderId or refreshTrigger changes
  useEffect(() => {
      fetchFolders();
  }, [currentFolderId, refreshTrigger]);

  async function fetchFolders() {
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.set('parent_id', currentFolderId);

      const response = await fetch(`/api/folders?${params}`);

      if (response.status === 401) return;

      const data = await response.json();

      if (response.ok) {
        setFolders(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    }
  }

  // Navigation Helper
  const navigateToPath = (path) => {
      setSearchTerm('');
      router.push(path || '/');
  };

  const handleFileUploaded = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFileDeleted = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSetupComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoginSuccess = () => {
      setShowLogin(false);
      setRefreshTrigger(prev => prev + 1);
  };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    const menuItems = [];

    if (type === 'folder') {
      menuItems.push({
        label: 'Open',
        icon: '📂',
        onClick: () => {
            const slug = item.slug || item.name.toLowerCase().replace(/\s/g, '-');
            const newPath = (currentPath === '/' ? '' : currentPath) + '/' + slug;
            navigateToPath(newPath);
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
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔒</span>
            <h1 className="text-lg font-bold text-slate-900">Telegram Files Manager</h1>
          </div>
          <Link href="/landing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition">
            Learn More
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 container-custom mx-auto py-6">
        {/* Folder Navigation Sidebar */}
        <aside className="xl:col-span-1">
          <FolderNav
            currentFolderId={currentFolderId}
            onFolderSelect={(path) => navigateToPath(path)}
            refreshTrigger={refreshTrigger}
          />
        </aside>

        {/* Main Content */}
        <main className="xl:col-span-3 space-y-6">
          {/* Breadcrumb & Settings Toggle */}
          <div className="flex items-center gap-4">
             <div className="flex-1">
                <Breadcrumb
                    currentPath={currentPath}
                    currentFolderId={currentFolderId}
                    currentFolderInfo={currentFolderInfo}
                    onNavigate={(path) => navigateToPath(path)}
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
                <p className="font-medium">Loading files...</p>
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
                <div className={`transition-opacity duration-200 ${loading ? 'opacity-50' : 'opacity-100'}`}>
                    <FileList
                      folders={folders}
                      files={files}
                      onFileDeleted={handleFileDeleted}
                      onFolderDoubleClick={(folderId) => {
                          const clickedFolder = folders.find(f => f.id === folderId);
                          if (clickedFolder) {
                              const slug = clickedFolder.slug || clickedFolder.name.toLowerCase().replace(/\s/g, '-');
                              const newPath = (currentPath === '/' ? '' : currentPath) + '/' + slug;
                              navigateToPath(newPath);
                          }
                      }}
                      onFolderCreated={handleFileUploaded}
                      onItemContextMenu={handleContextMenu}
                    />
                </div>

                {/* Loader Sentinel */}
                {hasMore && (
                    <div ref={observerTarget} className="py-4 flex justify-center text-gray-400 text-sm">
                        {loadingMore ? 'Loading more files...' : 'Scroll to load more'}
                    </div>
                )}
              </>
            )}
          </section>
        </main>
      </div>
    </DropZone>
  );
}
