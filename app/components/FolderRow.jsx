'use client';

import { useState } from 'react';

export default function FolderRow({ folder, onDoubleClick, onCreated, onDeleted, onContextMenu, onMove, isSelected, onSelectionChange }) {
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [clickCount, setClickCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const createdDate = new Date(folder.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete folder "${folder.name}"?`)) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/folders/${folder.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      if (onDeleted) onDeleted(folder.id);
      if (onCreated) onCreated(); // Keep for legacy if some parent expects it for other reasons
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === folder.name) {
      setRenaming(false);
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) throw new Error('Failed to rename');
      setRenaming(false);
      if (onCreated) onCreated();
    } catch (err) {
      console.error('Rename error:', err);
      alert('Rename failed');
    }
  };

  const handleRowClick = () => {
    setClickCount(prev => prev + 1);
    setTimeout(() => setClickCount(0), 300);

    // Simple double-click logic for row
    if (clickCount === 1) {
      onDoubleClick();
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
        const data = JSON.parse(e.dataTransfer.getData('application/json'));
        if (data.type === 'folder' && data.id === folder.id) return;

        if (onMove) {
             onMove(data.type, data.id, folder.id);
        }
    } catch (err) {
        console.error('Drop error:', err);
    }
  };

  return (
    <div
      className={`group flex items-center gap-4 p-3 border-b transition-colors cursor-pointer select-none cursor-move
        ${isSelected
          ? 'bg-blue-100 border-blue-200'
          : isDragOver
          ? 'bg-blue-100 border-blue-300 ring-inset ring-2 ring-blue-500'
          : 'bg-white border-gray-100 hover:bg-blue-50/50'
        }
      `}
      onClick={(e) => {
        if (e.target.type !== 'checkbox') {
          handleRowClick();
        }
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
         e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
         e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => onSelectionChange?.(folder.id, e)}
        className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Icon */}
      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-2xl">
        📁
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyPress={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
            className="w-full px-2 py-1 border border-blue-400 rounded text-sm"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3
            className="font-medium text-gray-900 truncate text-sm hover:text-blue-600"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
          >
            {folder.name}
          </h3>
        )}
      </div>

      {/* Metadata */}
      <div className="w-24 text-right text-sm text-gray-400 font-medium">
        -
      </div>
      <div className="w-28 text-right text-sm text-gray-500 hidden sm:block">
        {createdDate}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
          title="Open"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
