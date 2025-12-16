'use client';

import { useState } from 'react';

export default function FolderCard({ folder, onDoubleClick, onCreated, onContextMenu, onMove }) {
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(folder.name);
  const [error, setError] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Handle double-click to open folder
  const handleClick = () => {
    if (clickTimer) clearTimeout(clickTimer);

    setClickCount(prev => prev + 1);

    const timer = setTimeout(() => {
      setClickCount(0);
    }, 300);

    setClickTimer(timer);

    if (clickCount === 1) {
      // Double click detected
      onDoubleClick();
      setClickCount(0);
      clearTimeout(timer);
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
        // Prevent dropping folder into itself
        if (data.type === 'folder' && data.id === folder.id) return;

        if (onMove) {
            onMove(data.type, data.id, folder.id);
        }
    } catch (err) {
        console.error('Drop error:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${folder.name}"?`)) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete folder');
      }

      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message);
      console.error('Delete error:', err);
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
      setError(null);

      const response = await fetch(`/api/folders/${folder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to rename folder');
      }

      setRenaming(false);
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.message);
      console.error('Rename error:', err);
    }
  };

  const createdDate = new Date(folder.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div
      className={`group relative bg-white/70 backdrop-blur-md rounded-2xl p-4 border shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 cursor-move
        ${isDragOver ? 'border-blue-500 ring-2 ring-blue-400 bg-blue-50/80 scale-105' : 'border-white/50'}
      `}
      onDoubleClick={onDoubleClick}
      onClick={handleClick}
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
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 text-red-800 text-xs px-2 py-1 rounded flex items-start gap-1 absolute top-2 right-2 left-2 z-10">
          <span>⚠️</span>
          <span className="truncate">{error}</span>
        </div>
      )}

      {/* Folder Icon & Name */}
      <div className="relative z-10 flex flex-col items-center text-center pt-2">
        <div className="text-5xl mb-3 transform group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">📁</div>

        <div className="w-full px-2">
          {renaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyPress={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              className="w-full px-2 py-1 border border-blue-400 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90 text-center"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3
              className="font-semibold text-gray-800 truncate text-sm leading-tight group-hover:text-blue-600 transition-colors py-1"
              title={folder.name}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenaming(true);
              }}
            >
              {folder.name}
            </h3>
          )}
        </div>

        <p className="text-[10px] text-gray-400 mt-1 font-medium">
          {createdDate}
        </p>
      </div>

      {/* Action Overlay */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white/10 backdrop-blur-[1px] rounded-2xl z-20 pointer-events-none group-hover:pointer-events-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDoubleClick();
          }}
          className="bg-white/90 text-blue-600 p-2 rounded-full shadow-lg hover:bg-blue-600 hover:text-white transition-all transform hover:scale-110"
          title="Open"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="bg-white/90 text-red-600 p-2 rounded-full shadow-lg hover:bg-red-600 hover:text-white transition-all transform hover:scale-110"
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
