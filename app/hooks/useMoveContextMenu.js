import { useCallback, useState } from 'react';

export function useMoveContextMenu(folders) {
  const [isMoving, setIsMoving] = useState(false);

  const getMoveMenuItems = useCallback((selectedItems, selectedFolders, onMove) => {
    if (isMoving || (selectedItems.size === 0 && selectedFolders.size === 0)) return [];

    const itemCount = selectedItems.size + selectedFolders.size;
    const label = itemCount === 1 ? 'Move' : `Move ${itemCount} items`;

    return [
      {
        icon: '📋',
        label,
        submenu: [
          {
            icon: '📁',
            label: 'Root (My Files)',
            onClick: () => onMove?.(null),
          },
          ...(folders.length > 0 ? [{ type: 'divider' }] : []),
          ...folders.map(folder => ({
            icon: '📁',
            label: folder.name,
            onClick: () => onMove?.(folder.id),
          })),
        ],
      },
    ];
  }, [folders, isMoving]);

  const moveItems = useCallback(async (selectedItems, selectedFolders, targetFolderId) => {
    setIsMoving(true);
    try {
      const response = await fetch('/api/files/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: Array.from(selectedItems),
          folderIds: Array.from(selectedFolders),
          targetFolderId,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to move items');
      return data;
    } catch (err) {
      console.error('Move items error:', err);
      throw err;
    } finally {
      setIsMoving(false);
    }
  }, []);

  return {
    getMoveMenuItems,
    moveItems,
    isMoving,
    setIsMoving,
  };
}
