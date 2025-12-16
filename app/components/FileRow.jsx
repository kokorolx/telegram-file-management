'use client';

import { useState } from 'react';
import { formatFileSize, getFileExtension } from '@/lib/utils';
import PreviewModal from './PreviewModal';
import FileCardThumbnail from './FileCardThumbnail';

export default function FileRow({ file, onFileDeleted, onContextMenu }) {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState(null);

  const fileExt = getFileExtension(file.original_filename);
  const uploadDate = new Date(file.uploaded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isPreviewable = file.mime_type?.startsWith('image/') ||
                        file.mime_type?.startsWith('video/') ||
                        file.mime_type?.startsWith('audio/');

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      setDownloading(true);
      const response = await fetch(`/api/download?file_id=${encodeURIComponent(file.id)}`);
      if (!response.ok) throw new Error('Failed to download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this file?')) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      if (onFileDeleted) onFileDeleted();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div
        className="group flex items-center gap-4 p-3 bg-white border-b border-gray-100 hover:bg-blue-50/50 transition-colors cursor-pointer cursor-move"
        onClick={() => isPreviewable && setShowPreview(true)}
        onContextMenu={onContextMenu}
        draggable
        onDragStart={(e) => {
           e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
           e.dataTransfer.effectAllowed = 'move';
        }}
      >
        {/* Icon/Thumbnail */}
        <div className="w-10 h-10 flex-shrink-0 relative">
          {file.mime_type?.startsWith('image/') ? (
             <div className="w-10 h-10 rounded overflow-hidden">
                <FileCardThumbnail file={file} />
             </div>
          ) : (
            <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
              {fileExt ? fileExt.toUpperCase().slice(0, 4) : 'FILE'}
            </div>
          )}
        </div>

        {/* Name & Tags */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate text-sm" title={file.original_filename}>
              {file.original_filename}
            </h3>
            {file.tags && (
              <div className="flex gap-1">
                {file.tags.split(',').slice(0, 2).map((tag, i) => (
                  <span key={i} className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-medium">
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{file.description || 'No description'}</p>
        </div>

        {/* Metadata */}
        <div className="w-24 text-right text-sm text-gray-500 font-medium">
          {formatFileSize(file.file_size)}
        </div>
        <div className="w-28 text-right text-sm text-gray-500 hidden sm:block">
          {uploadDate}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
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

      <PreviewModal
        file={file}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </>
  );
}
