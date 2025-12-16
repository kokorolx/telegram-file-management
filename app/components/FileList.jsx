'use client';

import { useState, useEffect } from 'react';
import FileCard from './FileCard';
import FolderCard from './FolderCard';
import FileRow from './FileRow';
import FolderRow from './FolderRow';
import ViewToggle from './ViewToggle';

export default function FileList({ folders = [], files = [], onFileDeleted, onFolderDoubleClick, onFolderCreated, onItemContextMenu, onItemMove }) {
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState('grid');

  useEffect(() => {
    const savedView = localStorage.getItem('fileManagerViewMode');
    if (savedView) setViewMode(savedView);
  }, []);

  const handleViewChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('fileManagerViewMode', mode);
  };

  const sortedFiles = [...files].sort((a, b) => {
    switch (sortBy) {
      case 'date-desc':
        return new Date(b.uploaded_at) - new Date(a.uploaded_at);
      case 'date-asc':
        return new Date(a.uploaded_at) - new Date(b.uploaded_at);
      case 'name-asc':
        return a.original_filename.localeCompare(b.original_filename);
      case 'name-desc':
        return b.original_filename.localeCompare(a.original_filename);
      case 'size-desc':
        return b.file_size - a.file_size;
      case 'size-asc':
        return a.file_size - b.file_size;
      default:
        return 0;
    }
  });

  const totalItems = folders.length + sortedFiles.length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
           <ViewToggle view={viewMode} onChange={handleViewChange} />
           <p className="text-gray-700 font-medium text-sm">
             <span className="font-semibold">{folders.length}</span> folder{folders.length !== 1 ? 's' : ''}, <span className="font-semibold">{sortedFiles.length}</span> file{sortedFiles.length !== 1 ? 's' : ''}
           </p>
        </div>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-gray-50 font-medium hover:bg-gray-100 cursor-pointer"
        >
          <option value="date-desc">Newest First</option>
          <option value="date-asc">Oldest First</option>
          <option value="name-asc">Name (A-Z)</option>
          <option value="name-desc">Name (Z-A)</option>
          <option value="size-desc">Largest First</option>
          <option value="size-asc">Smallest First</option>
        </select>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 animate-fade-in">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onDoubleClick={() => onFolderDoubleClick(folder.id)}
              onCreated={onFolderCreated}
              onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, folder, 'folder')}
              onMove={onItemMove}
            />
          ))}

          {sortedFiles.map((file) => (
            <FileCard
                key={file.id}
                file={file}
                onFileDeleted={onFileDeleted}
                onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, file, 'file')}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fade-in">
           {/* List Header */}
           <div className="flex items-center gap-4 p-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
             <div className="w-10"></div>
             <div className="flex-1">Name</div>
             <div className="w-24 text-right">Size</div>
             <div className="w-28 text-right hidden sm:block">Date</div>
             <div className="w-16"></div>
           </div>

           <div className="divide-y divide-gray-100">
             {folders.map((folder) => (
               <FolderRow
                 key={folder.id}
                 folder={folder}
                 onDoubleClick={() => onFolderDoubleClick(folder.id)}
                 onCreated={onFolderCreated}
                 onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, folder, 'folder')}
                 onMove={onItemMove}
               />
             ))}

             {sortedFiles.map((file) => (
               <FileRow
                 key={file.id}
                 file={file}
                 onFileDeleted={onFileDeleted}
                 onContextMenu={(e) => onItemContextMenu && onItemContextMenu(e, file, 'file')}
               />
             ))}

             {folders.length === 0 && sortedFiles.length === 0 && (
               <div className="p-8 text-center text-gray-500">
                 No items to display
               </div>
             )}
           </div>
        </div>
      )}
    </div>
  );
}
