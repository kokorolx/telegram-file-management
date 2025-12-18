import { useState, useCallback } from 'react';

export function useMultiSelect() {
  const [selectedItems, setSelectedItems] = useState(new Set()); // Set of item IDs
  const [selectedFolders, setSelectedFolders] = useState(new Set());

  const toggleFile = useCallback((fileId, event) => {
    if (event?.shiftKey) {
      event.preventDefault();
    }
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  const toggleFolder = useCallback((folderId, event) => {
    if (event?.shiftKey) {
      event.preventDefault();
    }
    setSelectedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
    setSelectedFolders(new Set());
  }, []);

  const selectAllFiles = useCallback((fileIds) => {
    setSelectedItems(new Set(fileIds));
  }, []);

  const selectAllFolders = useCallback((folderIds) => {
    setSelectedFolders(new Set(folderIds));
  }, []);

  const hasSelection = selectedItems.size > 0 || selectedFolders.size > 0;
  const selectionCount = selectedItems.size + selectedFolders.size;

  return {
    selectedItems,
    selectedFolders,
    toggleFile,
    toggleFolder,
    clearSelection,
    selectAllFiles,
    selectAllFolders,
    hasSelection,
    selectionCount,
  };
}
