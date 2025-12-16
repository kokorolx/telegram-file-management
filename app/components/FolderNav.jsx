'use client';

import { useState, useEffect } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';

export default function FolderNav({ currentFolderId, onFolderSelect }) {
  const { isUnlocked, unlock, lock } = useEncryption();
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Unlock state
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

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

  const handleUnlock = async (e) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError('');

    try {
       const verifyRes = await fetch('/api/auth/verify-master', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ password: passwordInput })
       });

       const data = await verifyRes.json();
       if (!verifyRes.ok || !data.success) {
           throw new Error(data.error || "Invalid password");
       }

       unlock(passwordInput);
       setShowUnlockDialog(false);
       setPasswordInput('');
    } catch (err) {
        setUnlockError(err.message);
    } finally {
        setUnlocking(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6 sticky top-24 xl:top-24">
      <div>
        <h3 className="font-semibold text-gray-900 mb-4 text-base flex items-center gap-2">
          <span className="text-lg">📂</span>
          Folders
        </h3>

        {/* Vault Status */}
        <div className="mb-4">
          <button
            onClick={() => isUnlocked ? lock() : setShowUnlockDialog(true)}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                isUnlocked
                ? 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
            }`}
          >
            <span>{isUnlocked ? '🔓 Vault Unlocked' : '🔒 Vault Locked'}</span>
          </button>
        </div>

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

      {/* Unlock Dialog Modal */}
      {showUnlockDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm animate-scale-in" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Unlock Vault</h3>
                  <form onSubmit={handleUnlock}>
                      <input
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Enter Master Password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-4"
                        autoFocus
                      />
                      {unlockError && <p className="text-red-500 text-sm mb-4">{unlockError}</p>}
                      <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setShowUnlockDialog(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                              Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={unlocking}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                              {unlocking ? 'Verifying...' : 'Unlock'}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
}
