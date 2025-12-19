'use client';

import { useState, useEffect, useCallback, useRef, use } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import FileList from '../components/FileList';
import UploadForm from '../components/UploadForm';
import SetupModal from '../components/SetupModal';
import FolderNav from '../components/FolderNav';
import Breadcrumb from '../components/Breadcrumb';
import CreateFolderDialog from '../components/CreateFolderDialog';
import DropZone from '../components/DropZone';
import SettingsPanel from '../components/SettingsPanel';
import LoginDialog from '../components/LoginDialog';
import EnhancedContextMenu from '../components/EnhancedContextMenu';
import { FileListSkeletonGrid, FileListSkeletonRow } from '../components/SkeletonLoader';
import Link from 'next/link';
import { useUser } from '../contexts/UserContext';
import { useMultiSelect } from '../hooks/useMultiSelect';
import { useMoveContextMenu } from '../hooks/useMoveContextMenu';
import MoveItemsDialog from '../components/MoveItemsDialog';

export default function Home({ params: paramsPromise }) {
  const params = use(paramsPromise);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, checkAuth } = useUser();
  const uploadFormRef = useRef(null);

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
  const [viewMode, setViewMode] = useState('grid');

  // Multi-select state
  const { selectedItems, selectedFolders, toggleFile, toggleFolder, clearSelection, hasSelection, selectionCount } = useMultiSelect();
  const { getMoveMenuItems, moveItems, isMoving } = useMoveContextMenu(folders);
  const [showMoveDialog, setShowMoveDialog] = useState(false);

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

  // Handle Logout / Unauthenticated state
  useEffect(() => {
    if (!user) {
      setFiles([]);
      setFolders([]);
      setCurrentFolderId(null);
      setCurrentFolderInfo(null);
      setPage(1);
      setHasMore(false);
      setSearchTerm('');
    }
  }, [user]);

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

  const fetchFolders = useCallback(async () => {
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
  }, [currentFolderId]);

  // Navigation Helper
  const navigateToPath = (path) => {
      setSearchTerm('');
      router.push(path || '/');
  };

  const handleFileUploaded = () => {
    setRefreshTrigger(prev => prev + 1);
    // Force refresh folders immediately after file upload
    // This prevents the race condition where folders get cleared
    setTimeout(() => {
      fetchFolders();
    }, 100);
  };

  const handleFileDeleted = (fileId) => {
    if (fileId) {
      setFiles(prev => prev.filter(f => f.id !== fileId));
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handleFolderDeleted = (folderId) => {
    if (folderId) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
    }
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSetupComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoginSuccess = async () => {
       setShowLogin(false);
       await checkAuth(); // Refresh user state from cookie
       setRefreshTrigger(prev => prev + 1);
   };

   const handleLogout = async () => {
     await logout();
     router.push('/');
   };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();

    // Determine which items are selected AFTER this click
    let itemsToSelect = new Set(selectedItems);
    let foldersToSelect = new Set(selectedFolders);

    if (type === 'file' && !selectedItems.has(item.id)) {
      itemsToSelect.add(item.id);
    } else if (type === 'folder' && !selectedFolders.has(item.id)) {
      foldersToSelect.add(item.id);
    }

    const menuItems = [];
    const hasMultipleItems = itemsToSelect.size + foldersToSelect.size > 0;

    if (hasMultipleItems) {
      // Show multi-select context menu
      menuItems.push({
        icon: '📋',
        label: `Move ${itemsToSelect.size + foldersToSelect.size} item${itemsToSelect.size + foldersToSelect.size !== 1 ? 's' : ''}`,
        onClick: () => {
          // Update selection state first
          if (type === 'file' && !selectedItems.has(item.id)) toggleFile(item.id);
          if (type === 'folder' && !selectedFolders.has(item.id)) toggleFolder(item.id);
          setShowMoveDialog(true);
        }
      });

      if (itemsToSelect.size > 0) {
        menuItems.push({ type: 'divider' });
        menuItems.push({
          label: `Delete ${itemsToSelect.size} file${itemsToSelect.size !== 1 ? 's' : ''}`,
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!confirm(`Delete ${itemsToSelect.size} file(s)?`)) return;
            try {
              for (const fileId of itemsToSelect) {
                await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
              }
              setFiles(prev => prev.filter(f => !itemsToSelect.has(f.id)));
              clearSelection();
              setRefreshTrigger(prev => prev + 1);
            } catch (e) { console.error(e); alert('Failed to delete files'); }
          }
        });
      }

      if (foldersToSelect.size > 0) {
        menuItems.push({ type: 'divider' });
        menuItems.push({
          label: `Delete ${foldersToSelect.size} folder${foldersToSelect.size !== 1 ? 's' : ''}`,
          icon: '🗑️',
          danger: true,
          onClick: async () => {
            if (!confirm(`Delete ${foldersToSelect.size} folder(s)?`)) return;
            try {
              for (const folderId of foldersToSelect) {
                await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
              }
              setFolders(prev => prev.filter(f => !foldersToSelect.has(f.id)));
              clearSelection();
              setRefreshTrigger(prev => prev + 1);
            } catch (e) { console.error(e); alert('Failed to delete folders'); }
          }
        });
      }

      menuItems.push({ type: 'divider' });
      menuItems.push({
        label: 'Deselect All',
        icon: '✕',
        onClick: () => clearSelection()
      });
    } else {
      // Show single-item context menu
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
              setFolders(prev => prev.filter(f => f.id !== item.id));
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
              setFiles(prev => prev.filter(f => f.id !== item.id));
              setRefreshTrigger(prev => prev + 1);
            } catch (e) { console.error(e); }
          }
        });
      }
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

        // Update local state immediately for snappy feel
        if (type === 'file') {
            setFiles(prev => prev.filter(f => f.id !== itemId));
        } else if (type === 'folder') {
            setFolders(prev => prev.filter(f => f.id !== itemId));
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
      <SetupModal
        onSetupComplete={handleSetupComplete}
        refreshTrigger={refreshTrigger}
      />
      <SettingsPanel
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
        <EnhancedContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
      <MoveItemsDialog
        isOpen={showMoveDialog}
        onClose={() => setShowMoveDialog(false)}
        folders={folders}
        itemCount={selectionCount}
        fileCount={selectedItems.size}
        folderCount={selectedFolders.size}
        isMoving={isMoving}
        selectedFolders={selectedFolders}
        currentFolderId={currentFolderId}
        onFolderCreated={() => setRefreshTrigger(prev => prev + 1)}
        onMove={async (targetFolderId) => {
          try {
            await moveItems(selectedItems, selectedFolders, targetFolderId);

            // Update local state immediately
            if (selectedItems.size > 0) {
              setFiles(prev => prev.filter(f => !selectedItems.has(f.id)));
            }
            if (selectedFolders.size > 0) {
              setFolders(prev => prev.filter(f => !selectedFolders.has(f.id)));
            }

            clearSelection();
            setShowMoveDialog(false);
            setRefreshTrigger(prev => prev + 1);
          } catch (err) {
            alert('Failed to move items: ' + err.message);
          }
        }}
      />
      {/* Unified Header */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm">
        <div className="w-full px-4 xl:px-8 py-3 flex items-center justify-between gap-6">
          {/* Logo & Branding */}
          <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
              <span className="text-xl">🔒</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base font-bold text-slate-900 leading-none">Telegram</h1>
              <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Vault Manager</span>
            </div>
          </Link>

          {/* Breadcrumbs - Only show when logged in and not at root/landing if possible, or just always show when logged in */}
          {user && (
            <div className="flex-1 min-w-0 hidden md:block">
                <Breadcrumb
                    currentPath={currentPath}
                    currentFolderId={currentFolderId}
                    currentFolderInfo={currentFolderInfo}
                    onNavigate={(path) => navigateToPath(path)}
                />
            </div>
          )}

          {/* Actions & Profile */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {user ? (
              <>
                {/* Google Drive style 'New' button group */}
                <div className="flex bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20 overflow-hidden">
                    <button
                        onClick={() => uploadFormRef.current?.openFilePicker()}
                        className="px-4 py-2 text-white hover:bg-blue-700 font-bold text-sm flex items-center gap-2 transition-colors border-r border-blue-500/50"
                        title="Upload Files"
                    >
                        <span>📤</span> <span className="hidden sm:inline">Upload</span>
                    </button>
                    <button
                        onClick={() => setShowCreateFolder(true)}
                        className="px-4 py-2 text-white hover:bg-blue-700 font-bold text-sm flex items-center gap-2 transition-colors"
                        title="New Folder"
                    >
                        <span>+</span> <span className="hidden sm:inline">Folder</span>
                    </button>
                </div>

                <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>

                <button
                    onClick={() => setShowSettings(true)}
                    title="Storage & Settings"
                    className="p-2 rounded-xl bg-slate-100 hover:bg-white text-slate-600 hover:text-blue-600 transition-all border border-slate-200"
                >
                    <span className="text-lg leading-none">⚙️</span>
                </button>

                <div className="w-[1px] h-6 bg-slate-200 mx-1"></div>

                <div className="flex items-center gap-3">
                  <div className="hidden lg:flex flex-col items-end">
                    <span className="text-xs font-bold text-slate-900">{user.username}</span>
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Active
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Logout"
                    className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all"
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      {!user ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-fade-in">
          <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-blue-50">
            <span className="text-4xl text-blue-600">📁</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Welcome to Telegram Files</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-8 text-lg">
            A secure way to store and manage your files using Telegram as a backend.
            End-to-end encrypted and completely free.
          </p>
          <div className="flex gap-4">
              <button
                onClick={() => setShowLogin(true)}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
              >
                <span>🚀</span> Get Started
              </button>
              <Link
                href="/landing"
                className="px-8 py-3 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition-all"
              >
                Learn More
              </Link>
          </div>
        </div>
      ) : (
      <div className="flex flex-col xl:flex-row gap-6 w-full px-4 xl:px-8 py-6">
        {/* Folder Navigation Sidebar */}
        <aside className="xl:w-80 flex-shrink-0">
          <FolderNav
            currentFolderId={currentFolderId}
            onFolderSelect={(path) => navigateToPath(path)}
            refreshTrigger={refreshTrigger}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Mobile Breadcrumbs (hidden on md+) */}
          <div className="md:hidden">
              <Breadcrumb
                  currentPath={currentPath}
                  currentFolderId={currentFolderId}
                  currentFolderInfo={currentFolderInfo}
                  onNavigate={(path) => navigateToPath(path)}
              />
          </div>

          <UploadForm
              ref={uploadFormRef}
              onFileUploaded={handleFileUploaded}
              currentFolderId={currentFolderId}
              externalFiles={droppedFiles}
              hideDropZone={true}
          />

          {/* Files Section */}
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>📚</span>
                {currentFolderInfo ? currentFolderInfo.name : 'My Files'}
              </h2>
            </div>

            {/* Selection Bar */}
            {hasSelection && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-blue-900">
                    {selectionCount} item{selectionCount !== 1 ? 's' : ''} selected
                  </span>
                  {selectedItems.size > 0 && (
                    <span className="text-xs text-blue-700">
                      {selectedItems.size} file{selectedItems.size !== 1 ? 's' : ''}
                    </span>
                  )}
                  {selectedFolders.size > 0 && (
                    <span className="text-xs text-blue-700">
                      {selectedFolders.size} folder{selectedFolders.size !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={clearSelection}
                  className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                >
                  Deselect All
                </button>
              </div>
            )}

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

            {loading && files.length === 0 && folders.length === 0 ? (
              // Show skeleton while first load
              viewMode === 'grid' ? (
                <FileListSkeletonGrid />
              ) : (
                <FileListSkeletonRow />
              )
            ) : folders.length === 0 && files.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in-smooth border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm ring-1 ring-blue-50">
                  <span className="text-4xl">{searchTerm ? '🔍' : '☁️'}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {searchTerm ? 'No matches found' : 'Your vault is empty'}
                </h3>
                <p className="text-gray-500 max-w-sm mb-8">
                  {searchTerm
                    ? `We couldn't find anything matching "${searchTerm}". Try a different search term or clear the search.`
                    : 'Start securing your data by dragging files here, or use the upload button to select from your device.'}
                </p>
                {!searchTerm && (
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                      onClick={() => uploadFormRef.current?.openFilePicker()}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
                    >
                      <span>📤</span> Upload your first file
                    </button>
                    <Link
                      href="/landing"
                      className="px-6 py-2.5 bg-white text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 font-bold text-sm transition-all"
                    >
                      Learn how it works
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Smooth transition wrapper */}
                <div className={`transition-all duration-300 ${loading && files.length > 0 ? 'opacity-60' : 'opacity-100'}`}>
                    <FileList
                      folders={folders}
                      files={files}
                      onFileDeleted={handleFileDeleted}
                      onFolderDeleted={handleFolderDeleted}
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
                      onItemMove={handleItemMove}
                      onViewModeChange={setViewMode}
                      selectedItems={selectedItems}
                      selectedFolders={selectedFolders}
                      onFileSelect={toggleFile}
                      onFolderSelect={toggleFolder}
                    />
                </div>

                {/* Loading indicator overlay - subtle and non-intrusive */}
                {loading && files.length > 0 && (
                    <div className="flex justify-center py-4">
                        <div className="text-gray-400 text-sm flex items-center gap-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                            Loading files...
                        </div>
                    </div>
                )}

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
    )}
    </DropZone>
  );
}
