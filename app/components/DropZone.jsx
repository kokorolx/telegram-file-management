'use client';

import { useState, useEffect } from 'react';

export default function DropZone({ onFilesDropped, children }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragCounter, setDragCounter] = useState(0);

  useEffect(() => {
    // Prevent default browser behavior for drag-and-drop
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
        if (!isFileDrag) return;

        setIsDragOver(false);
        setDragCounter(0);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          onFilesDropped(e.dataTransfer.files);
        }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onFilesDropped]);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if dragging actual files from OS
    const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
    if (!isFileDrag) return;

    setDragCounter((prev) => prev + 1);
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
    if (!isFileDrag) return;

    setDragCounter((prev) => Math.max(0, prev - 1));
    if (dragCounter <= 1) {
        setIsDragOver(false);
    }
  };

  return (
    <div
        className="relative min-h-screen"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-4 border-blue-500 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="bg-white/90 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
            <span className="text-6xl mb-4 animate-bounce">📂</span>
            <h2 className="text-2xl font-bold text-blue-600">Drop files to upload</h2>
            <p className="text-gray-500">Release to add to current folder</p>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
