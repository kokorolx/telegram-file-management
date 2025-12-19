import { useState } from 'react';
import { formatFileSize, getFileExtension } from '@/lib/utils';
import Lightbox from './Lightbox';
import FileCardThumbnail from './FileCardThumbnail';
import FilePasswordOverrideModal from './FilePasswordOverrideModal';
import { useEncryption } from '../contexts/EncryptionContext';
import { blobCache } from '@/lib/secureImageCache'; // Add import

export default function FileRow({ file, onFileDeleted, onContextMenu, onFileMoved, isSelected, onSelectionChange }) {
  const { masterPassword, encryptionKey, isUnlocked } = useEncryption();
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showPasswordOverride, setShowPasswordOverride] = useState(false);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState(null);
  const [fileKey, setFileKey] = useState(null);

  const fileExt = getFileExtension(file.original_filename);
  // ... date ...
  const uploadDate = new Date(file.uploaded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const isPreviewable = true; // All files can now be opened in unified Lightbox (with fallbacks)

  const performDecryptionAndDownload = async (key) => {
    try {
      setDownloading(true);
      const { fetchFilePartMetadata, fetchAndDecryptFullFile } = await import('@/lib/clientDecryption');
      const parts = await fetchFilePartMetadata(file.id);
      const blob = await fetchAndDecryptFullFile(file.id, key, parts);

      const url = window.URL.createObjectURL(blob);

      // Cache if encrypted
      if (file.is_encrypted) {
        blobCache.set(file.id, { url, timestamp: Date.now() });
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      await fetch(`/api/stats/file/${file.id}/download`, { method: 'POST' });
    } catch (err) {
      console.error('Decryption/Download error:', err);
      if (err.message.includes('decrypt') || err.message.includes('auth')) {
        setShowPasswordOverride(true);
      } else {
        alert('Download failed: ' + err.message);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      if (file.is_encrypted && !isUnlocked) {
          alert("Please unlock with Master Password first");
          return;
      }

      // Check Cache
      if (file.is_encrypted && blobCache.has(file.id)) {
          const { url } = blobCache.get(file.id);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.original_filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          await fetch(`/api/stats/file/${file.id}/download`, { method: 'POST' });
          return;
      }

      if (file.is_encrypted) {
        await performDecryptionAndDownload(fileKey || encryptionKey);
      } else {
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
        await fetch(`/api/stats/file/${file.id}/download`, { method: 'POST' });
        setDownloading(false);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Download failed');
      setDownloading(false);
    }
  };

  const handleMoveClick = async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch('/api/folders?user_folders=true');
      if (!res.ok) throw new Error('Failed to fetch folders');
      const data = await res.json();
      setFolders(data.folders || []);
      setShowMoveModal(true);
    } catch (err) {
      console.error('Fetch folders error:', err);
      alert('Failed to load folders');
    }
  };

  const handleMoveFile = async () => {
    try {
      setMoving(true);
      const res = await fetch('/api/files/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id, targetFolderId: selectedFolder })
      });

      if (!res.ok) throw new Error('Failed to move file');
      setShowMoveModal(false);
      setSelectedFolder(null);
      if (onFileMoved) onFileMoved(selectedFolder);
    } catch (err) {
      console.error('Move file error:', err);
      alert('Failed to move file');
    } finally {
      setMoving(false);
    }
  };


  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!confirm('Delete this file?')) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/files/${file.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
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
        className={`group flex items-center gap-4 p-3 border-b border-gray-100 transition-colors cursor-pointer cursor-move ${
          isSelected ? 'bg-blue-100 border-blue-200' : 'bg-white hover:bg-blue-50/50'
        }`}
        onClick={(e) => {
          if (e.target.type !== 'checkbox') {
            setShowFullscreen(true);
          }
        }}
        onContextMenu={onContextMenu}
        draggable
        onDragStart={(e) => {
           e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
           e.dataTransfer.effectAllowed = 'move';
        }}
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onSelectionChange?.(file.id, e)}
          className="w-4 h-4 rounded cursor-pointer flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        />

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
          {isPreviewable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFullscreen(true);
              }}
              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
              title="Fullscreen Preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6v4m12-4h4v4M6 18h-4v-4m16 4h4v-4" />
              </svg>
            </button>
          )}
          <button
            onClick={handleMoveClick}
            disabled={moving}
            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
            title="Move"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
          {(!file.is_encrypted || masterPassword) && (
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
          )}
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

      <Lightbox
        file={file}
        isOpen={showFullscreen}
        onClose={() => setShowFullscreen(false)}
        onDecryptionError={() => {
          setShowFullscreen(false);
          setShowPasswordOverride(true);
        }}
        customKey={fileKey}
      />

      <FilePasswordOverrideModal
        isOpen={showPasswordOverride}
        file={file}
        onClose={() => setShowPasswordOverride(false)}
        onSuccess={(key) => {
          setFileKey(key);
          setShowFullscreen(true);
        }}
      />

      {showMoveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Move File</h3>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
              <button
                onClick={() => setSelectedFolder(null)}
                className={`w-full text-left px-4 py-2 rounded ${
                  selectedFolder === null ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                }`}
              >
                Root
              </button>
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className={`w-full text-left px-4 py-2 rounded ${
                    selectedFolder === folder.id ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                  }`}
                >
                  {folder.name}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setSelectedFolder(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveFile}
                disabled={moving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {moving ? 'Moving...' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}


    </>
  );
}
