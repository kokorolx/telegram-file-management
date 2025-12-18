import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';

export default function MoveItemsDialog({
  isOpen,
  onClose,
  itemCount,
  fileCount,
  folderCount,
  onMove,
  isMoving,
  selectedFolders = new Set(),
  currentFolderId = null,
  onFolderCreated
}) {
  const [browserFolderId, setBrowserFolderId] = useState(null);
  const [browsingFolders, setBrowsingFolders] = useState([]);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Files' }]);
  const [loading, setLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Initialize browser folder when dialog opens
  useEffect(() => {
    if (isOpen) {
      setBrowserFolderId(currentFolderId);
    }
  }, [isOpen, currentFolderId]);

  const fetchFolders = useCallback(async (parentId) => {
    setLoading(true);
    try {
      const url = parentId
        ? `/api/folders?parent_id=${parentId}`
        : '/api/folders';
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok) {
        setBrowsingFolders(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching folders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBreadcrumbs = useCallback(async (folderId) => {
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: 'My Files' }]);
      return;
    }

    try {
      const crumbs = [];
      let currentId = folderId;
      while (currentId) {
        const response = await fetch(`/api/folders/${currentId}`);
        if (!response.ok) break;
        const data = await response.json();
        const folder = data.data;
        crumbs.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parent_id;
      }
      crumbs.unshift({ id: null, name: 'My Files' });
      setBreadcrumbs(crumbs);
    } catch (err) {
      console.error('Error fetching breadcrumbs:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFolders(browserFolderId);
      fetchBreadcrumbs(browserFolderId);
    }
  }, [isOpen, browserFolderId, fetchFolders, fetchBreadcrumbs]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setIsCreatingFolder(true);
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parent_id: browserFolderId
        })
      });

      if (response.ok) {
        setNewFolderName('');
        setShowCreateFolder(false);
        fetchFolders(browserFolderId);
        if (onFolderCreated) onFolderCreated();
      }
    } catch (err) {
      alert('Error creating folder: ' + err.message);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const isInvalidTarget = (folderId) => {
    // Cannot move into any of the folders being moved
    return selectedFolders.has(folderId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl w-full">
      <div className="flex flex-col h-[600px] max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-bold text-gray-900">Move Items</h3>
            <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 p-1"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Moving {itemCount} item{itemCount !== 1 ? 's' : ''}
            {fileCount > 0 && ` (${fileCount} file${fileCount !== 1 ? 's' : ''})`}
            {folderCount > 0 && ` (${folderCount} folder${folderCount !== 1 ? 's' : ''})`}
          </p>
        </div>

        {/* Breadcrumb Navigation */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
          {breadcrumbs.map((crumb, idx) => (
            <div key={crumb.id || 'root'} className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setBrowserFolderId(crumb.id)}
                className={`px-2 py-1 rounded-md text-sm font-medium transition-colors ${
                  idx === breadcrumbs.length - 1
                    ? 'text-gray-900 bg-white shadow-sm border border-gray-200'
                    : 'text-blue-600 hover:bg-blue-50'
                }`}
              >
                {crumb.name}
              </button>
              {idx < breadcrumbs.length - 1 && (
                <span className="text-gray-400 text-xs">/</span>
              )}
            </div>
          ))}
        </div>

        {/* Folder List Area */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p>Loading folders...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-1">
              {/* Parent Directory Link (only if not at root) */}
              {browserFolderId && breadcrumbs.length > 1 && (
                <button
                  onClick={() => setBrowserFolderId(breadcrumbs[breadcrumbs.length - 2].id)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-gray-50 transition-colors text-left text-gray-600 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl group-hover:bg-gray-200 transition-colors">
                    ⬆️
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Up to Parent</p>
                    <p className="text-[10px] text-gray-400">Back to {breadcrumbs[breadcrumbs.length - 2].name}</p>
                  </div>
                </button>
              )}

              {browsingFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <div className="text-4xl mb-3">📁</div>
                  <p className="text-sm">This folder is empty</p>
                </div>
              ) : (
                browsingFolders.map(folder => {
                  const isDisabled = isInvalidTarget(folder.id);
                  return (
                    <div
                        key={folder.id}
                        className={`group flex items-center justify-between w-full p-3 rounded-xl transition-all ${
                            isDisabled
                                ? 'opacity-40 cursor-not-allowed bg-gray-50 grayscale'
                                : 'hover:bg-blue-50/50 cursor-pointer'
                        }`}
                        onClick={() => !isDisabled && setBrowserFolderId(folder.id)}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl transition-transform ${!isDisabled && 'group-hover:scale-110'}`}>
                                📁
                            </div>
                            <div className="min-w-0">
                                <p className={`font-semibold text-sm truncate ${isDisabled ? 'text-gray-500' : 'text-gray-800'}`}>
                                    {folder.name}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                    {isDisabled ? 'Cannot move here (Source folder)' : 'Subfolder'}
                                </p>
                            </div>
                        </div>
                        {!isDisabled && (
                            <div className="text-gray-300 group-hover:text-blue-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Footer / Create Folder */}
        <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl flex-shrink-0">
          {showCreateFolder ? (
            <div className="mb-4 animate-in slide-in-from-bottom-2 duration-200">
              <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">New Folder Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  placeholder="e.g. Work Documents"
                  autoFocus
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                />
                <button
                  onClick={handleCreateFolder}
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all font-bold shadow-lg shadow-blue-500/20"
                >
                  {isCreatingFolder ? '...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreateFolder(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-xl hover:bg-gray-200 transition-all font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase">Current Folder:</span>
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                        {breadcrumbs[breadcrumbs.length - 1]?.name || 'My Files'}
                    </span>
                </div>
                <button
                  onClick={() => setShowCreateFolder(true)}
                  className="text-sm font-bold text-blue-600 hover:text-blue-700 underline decoration-2 underline-offset-4"
                >
                  + Add New Subfolder
                </button>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 font-bold text-gray-600 transition-all"
            >
              Cancel
            </button>
            <button
                onClick={() => onMove(browserFolderId)}
                disabled={isMoving || selectedFolders.has(browserFolderId)}
                className="flex-[2] px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold shadow-xl shadow-blue-500/25 disabled:opacity-50 transition-all flex flex-col items-center justify-center gap-0.5"
            >
                {isMoving ? (
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Moving...</span>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                             <span>Move to</span>
                             <span className="opacity-80">"{breadcrumbs[breadcrumbs.length - 1]?.name || 'My Files'}"</span>
                        </div>
                        {selectedFolders.has(browserFolderId) && (
                            <span className="text-[10px] text-yellow-200 font-medium">⚠️ Cannot move a folder into itself</span>
                        )}
                    </>
                )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
