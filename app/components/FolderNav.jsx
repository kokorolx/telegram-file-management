'use client';

import { useState, useEffect } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { useUser } from '../contexts/UserContext';
import Modal from './Modal';

export default function FolderNav({ currentFolderId, onFolderSelect, refreshTrigger }) {
  const { user } = useUser();
  const { isUnlocked, unlock, lock } = useEncryption();
  const [folders, setFolders] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Unlock state
  const [showUnlockDialog, setShowUnlockDialog] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // State for lazy loading
  const [childrenMap, setChildrenMap] = useState({}); // folderId -> array of children

  // Handle Logout
  useEffect(() => {
    if (!user) {
      setFolders([]);
      setChildrenMap({});
      setExpandedFolders(new Set());
      setError(null);
    }
  }, [user]);

  useEffect(() => {
    if (user) loadRootFolders();
  }, [refreshTrigger, user]);

  async function loadRootFolders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/folders'); // Defaults to root (parent_id=null)
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

  // Auto-expand to current folder
  useEffect(() => {
      if (currentFolderId && folders.length > 0) { // Only if we have roots loaded
          expandToFolder(currentFolderId);
      }
      // If currentFolderId is null, we are at root.
  }, [currentFolderId, folders.length]); // Depend on folders.length so we run after initial load

  const expandToFolder = async (targetId) => {
      // We need to build a chain of IDs from target up to root.
      // Then ensure each is loaded in childrenMap and expanded.

      // 1. Trace up parents (simulating Breadcrumb logic, but we might want an API for this to be faster)
      // For now, iterative fetch is safe.

      const chain = [];
      let currentId = targetId;

      try {
          // Safety valve to prevent infinite loops
          let loopCount = 0;
          while (currentId && loopCount < 10) {
              loopCount++;

              // If we already have this folder in our "folders" (root) or "childrenMap", we might know its parent?
              // Not easily, childrenMap is by parentId.
              // So we effectively need to fetch folder info to get parent_id.

              const res = await fetch(`/api/folders/${currentId}`);
              if (!res.ok) break;
              const data = await res.json();
              const folder = data.data;

              chain.unshift(folder); // [Grandparent, Parent, Child]

              if (!folder.parent_id) break; // Reached root (or a folder with no parent)
              currentId = folder.parent_id;
          }

          // 2. Now walk down the chain, loading children and expanding
          // Chain now contains the path from a Root (or near root) to Target.
          // The first item should be a root folder or child of a root.

          let newChildrenMap = { ...childrenMap }; // Copy state
          let newExpanded = new Set(expandedFolders);
          let mapEffectivelyChanged = false;
          let expandedChanged = false;

          // We need to process sequentially to ensure we can 'get' the next level.
          // Actually, we can just fetch children for every parent in the chain.

          // Parent of first item is folder.parent_id (Using it to verify it's a root from our list?)
          // If first item.parent_id is null, it should be in `folders`.

          for (let i = 0; i < chain.length; i++) {
              const folder = chain[i];
              // If this is NOT the last item (target), we must expand it.
              // Actually, we also want to see the target in the tree, so its parent must be expanded.

              if (folder.parent_id) {
                   // Ensure parent is expanded
                   if (!newExpanded.has(folder.parent_id)) {
                       newExpanded.add(folder.parent_id);
                       expandedChanged = true;
                   }
                   // Ensure parent's children are loaded
                   if (!newChildrenMap[folder.parent_id]) {
                       const kidsRes = await fetch(`/api/folders?parent_id=${folder.parent_id}`);
                       if (kidsRes.ok) {
                           const kidsData = await kidsRes.json();
                           newChildrenMap[folder.parent_id] = kidsData.data || [];
                           mapEffectivelyChanged = true;
                       }
                   }
              } else {
                  // Root folder.
                  // Just ensure it's in our `folders` list? It should be from `loadRootFolders`.
                  // If we want to verify target is visible, we don't need to expand target itself unless we want to see its children.
                  // But we MUST expand its parent.
              }

              // If this IS the target, and we want to show its children immediately (auto-expand active?), we can:
              if (folder.id === targetId) {
                  // Should we expand the active folder? Usually UI keeps active folder closed unless explicit.
                  // But typically we want to see siblings. Siblings are loaded by parent.
              } else {
                  // It is a parent of our target. Expand it.
                  if (!newExpanded.has(folder.id)) {
                      newExpanded.add(folder.id);
                      expandedChanged = true;
                  }
                   // Load its children so next item in chain exists
                   if (!newChildrenMap[folder.id]) {
                       const kidsRes = await fetch(`/api/folders?parent_id=${folder.id}`);
                       if (kidsRes.ok) {
                           const kidsData = await kidsRes.json();
                           newChildrenMap[folder.id] = kidsData.data || [];
                           mapEffectivelyChanged = true;
                       }
                   }
              }
          }

          if (mapEffectivelyChanged) setChildrenMap(newChildrenMap);
          if (expandedChanged) setExpandedFolders(newExpanded);

      } catch (err) {
          console.error("Auto-expand error:", err);
      }
  };

  const fetchChildren = async (folderId) => {
      // If we already have children, don't re-fetch unless forced?
      // For now, simple caching: if in map, use it.
      if (childrenMap[folderId]) return;

      try {
          const response = await fetch(`/api/folders?parent_id=${folderId}`);
          const data = await response.json();
          if (response.ok) {
              setChildrenMap(prev => ({
                  ...prev,
                  [folderId]: data.data || []
              }));
          }
      } catch (err) {
          console.error("Failed to load subfolders", err);
      }
  };

  const toggleFolder = async (folderId, e) => {
    e?.stopPropagation();
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      // Lazy load children
      await fetchChildren(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  // We no longer build a full tree upfront from a flat list logic
  // Instead we render recursively using `folders` (root) and `childrenMap`.

  const FolderTreeItem = ({ folder, parentPath = '', ancestorIds = new Set() }) => {
     // Prevent circular references: filter out any children that are ancestors of this folder
     const allChildren = childrenMap[folder.id] || [];
     const children = allChildren.filter(child => {
         // Prevent a folder from appearing inside itself
         if (child.id === folder.id) return false;
         // Prevent circular references (ancestor appearing as child)
         if (ancestorIds.has(child.id)) return false;
         return true;
     });
     
     const isExpanded = expandedFolders.has(folder.id);
     const isSelected = currentFolderId === folder.id;

     // Calculate path for this folder
     const slug = folder.slug || folder.name.toLowerCase().replace(/\s+/g, '-');
     const currentPath = `${parentPath}/${slug}`;

     // Show arrow if we have children OR if we haven't loaded them yet (heuristic)
     // If we loaded and it's empty, hide arrow?
     // Let's check: if childrenMap[folder.id] is undefined, we haven't loaded. Show arrow.
     // If it is defined and length > 0, show arrow.
     // If defined and length === 0, hide arrow.
     const hasLoaded = childrenMap[folder.id] !== undefined;
     const showArrow = !hasLoaded || children.length > 0;

     return (
        <div className="select-none">
           <div
             className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                 isSelected ? 'bg-blue-100 text-blue-900 font-medium' : 'hover:bg-gray-100 text-gray-700'
             }`}
             style={{ paddingLeft: '8px' }} // Indentation handled by nesting div? No, usually padding.
             // Actually, the recursion structure adds divs? No, it nests <div>{children}</div>.
             // But if we want simple visual tree, usually we just indent the children container.
             // Let's use padding-left on the container of children?
             // Or keep the `level` prop for padding calc?
             // Let's keep `level` for padding calc on the ITEM itself to avoid deep nesting DOM issues if possible?
             // But wait, standard recursive tree usually nests.
             // If we nest logic:
             // <div style={{ paddingLeft: 16 }}> <Children /> </div>
             onClick={() => onFolderSelect(currentPath)}
           >
              <div
                className="w-4 h-4 flex items-center justify-center cursor-pointer text-gray-400 hover:text-gray-600 mr-1"
                onClick={(e) => {
                    if (showArrow) toggleFolder(folder.id, e);
                }}
              >
                  {showArrow && (
                      <span className="text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                  )}
              </div>
              <span className="text-lg">📂</span>
              <span className="truncate text-sm">{folder.name}</span>
           </div>

           {isExpanded && (
               <div className="pl-4">
                   {children.length === 0 ? (
                       !hasLoaded ? <div className="px-2 py-1 text-xs text-gray-400">Loading...</div> : <div className="px-2 py-1 text-xs text-gray-400">Empty</div>
                   ) : (
                       children.map(child => {
                           const newAncestorIds = new Set(ancestorIds);
                           newAncestorIds.add(folder.id);
                           return (
                               <FolderTreeItem key={child.id} folder={child} parentPath={currentPath} ancestorIds={newAncestorIds} />
                           );
                       })
                   )}
               </div>
           )}
        </div>
     );
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

       await unlock(passwordInput, data.salt);
       setShowUnlockDialog(false);
       setPasswordInput('');
    } catch (err) {
        setUnlockError(err.message);
    } finally {
        setUnlocking(false);
    }
  };

  // ... (handleUnlock remains)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-6 sticky top-24 xl:top-24">
      {/* ... (sidebar content remains) ... */}
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
          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm mb-1 transition-colors font-medium flex items-center gap-2 ${
            currentFolderId === null
              ? 'bg-blue-100 text-blue-900 border border-blue-200'
              : 'hover:bg-gray-100 text-gray-700 border border-transparent'
          }`}
        >
          <span className="w-5"></span> {/* Indent spacer matching toggle arrow */}
          <span className="text-lg">📁</span>
          My Files
        </button>

        {/* Folder list */}
        {loading ? (
          <div className="text-center py-6 text-gray-500 text-sm">Loading folders...</div>
        ) : folders.length === 0 ? (
          <div className="text-center py-6 text-gray-500 text-sm">No folders yet</div>
        ) : (
          <div className="space-y-0.5 mt-1">
            {folders.map((folder) => (
              <FolderTreeItem key={folder.id} folder={folder} />
            ))}
          </div>
        )}
      </div>

      {/* Unlock Dialog Modal */}
      <Modal isOpen={showUnlockDialog} onClose={() => setShowUnlockDialog(false)} className="max-w-sm">
          <div className="p-6">
              <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">🔒</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Unlock Vault</h3>
                  <p className="text-sm text-gray-500 mt-1">Enter your master password to access encrypted files.</p>
              </div>

              <form onSubmit={handleUnlock}>
                  <div className="relative mb-4">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Master Password"
                        className="w-full pl-4 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-900 placeholder-gray-400 transition-all font-medium"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                        tabIndex="-1"
                      >
                         {showPassword ? '👁️' : '🙈'}
                      </button>
                  </div>

                  {unlockError && (
                      <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
                          <span className="text-red-500 mt-0.5">⚠️</span>
                          <p className="text-red-600 text-sm">{unlockError}</p>
                      </div>
                  )}

                  <div className="flex gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setShowUnlockDialog(false)}
                        className="flex-1 px-4 py-2.5 text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl font-medium transition-colors border border-gray-200"
                      >
                          Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={unlocking}
                        className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-70 disabled:shadow-none"
                      >
                          {unlocking ? 'Verifying...' : 'Unlock'}
                      </button>
                  </div>
              </form>
          </div>
      </Modal>
    </div>
  );
}
