import { useState } from 'react';
import { formatFileSize, getFileExtension } from '@/lib/utils';
import Lightbox from './Lightbox';
import FileCardThumbnail from './FileCardThumbnail';
import FilePasswordOverrideModal from './FilePasswordOverrideModal';
import { useEncryption } from '../contexts/EncryptionContext';
import { blobCache } from '@/lib/secureImageCache'; // Add import

export default function FileCard({ file, onFileDeleted, onFileMoved, onContextMenu }) {
  const { masterPassword, encryptionKey, isUnlocked } = useEncryption(); // Assuming unlock might trigger UI in future, or we check isUnlocked
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPasswordOverride, setShowPasswordOverride] = useState(false);
  const [error, setError] = useState(null);
  const [fileKey, setFileKey] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false); // Add move modal state if we want to add a move button
  const [moving, setMoving] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folders, setFolders] = useState([]); // To populate move modal if needed

  const fileExt = getFileExtension(file.original_filename);
  // ... date logic ...
  const uploadDate = new Date(file.uploaded_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // ... checks ...
  const isImage = file.mime_type?.startsWith('image/');
  const isVideo = file.mime_type?.startsWith('video/');
  const isAudio = file.mime_type?.startsWith('audio/');
  const isPdf = file.mime_type?.includes('pdf') || file.original_filename?.toLowerCase().endsWith('.pdf');
  // Preview button shows for all file types (media + PDF + unsupported file type thumbnails)
  const isPreviewable = true;

  const performDecryptionAndDownload = async (key) => {
    try {
      setDownloading(true);
      setError(null);
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
        setError('Download failed: ' + err.message);
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (file.is_encrypted && !isUnlocked) {
          alert("Please unlock with Master Password first (Top Menu)");
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
          return;
      }

      if (file.is_encrypted) {
        await performDecryptionAndDownload(fileKey || encryptionKey);
      } else {
        setDownloading(true);
        setError(null);
        const response = await fetch(`/api/download?file_id=${encodeURIComponent(file.id)}`);
        if (!response.ok) throw new Error('Failed to download file');
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
      setError(err.message);
      console.error('Download error:', err);
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return;
    }

    try {
      setDeleting(true);
      setError(null);

      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete file');
      }

      if (onFileDeleted) {
        onFileDeleted(file.id);
      }
    } catch (err) {
      setError(err.message);
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-3 h-full flex flex-col cursor-move"
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {error && (
        <div className="mb-2 bg-red-50 border border-red-100 text-red-600 text-[10px] px-2 py-1 rounded absolute top-2 right-2 left-2 z-20">
          ⚠️ {error}
        </div>
      )}

      {/* Thumbnail Area */}
      <div className="relative aspect-[4/3] mb-3 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center group-hover:shadow-inner transition-all">
        {file.mime_type?.startsWith('image/') ? (
          <div className="w-full h-full">
             <FileCardThumbnail file={file} />
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg mb-2">
              {fileExt ? fileExt.toUpperCase().slice(0, 4) : 'FILE'}
            </div>
          </div>
        )}

        {/* Hover Actions Overlay */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          {isPreviewable && (
            <button
              onClick={() => setShowFullscreen(true)}
              className="bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-blue-50 hover:text-blue-600 transition-all transform hover:scale-110"
              title="View File"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {(!file.is_encrypted || masterPassword) && (
          <button
            onClick={handleDownload}
            className="bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-green-50 hover:text-green-600 transition-all transform hover:scale-110"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          )}
          <button
            onClick={handleDelete}
            className="bg-white text-gray-800 p-2 rounded-full shadow-lg hover:bg-red-50 hover:text-red-600 transition-all transform hover:scale-110"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 mt-auto">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 truncate text-xs leading-5" title={file.original_filename}>
            {file.original_filename}
          </h3>
          <p className="text-[10px] text-gray-400 font-medium">
            {formatFileSize(file.file_size)} • {uploadDate}
          </p>
        </div>
      </div>

      {file.tags && (
        <div className="mt-2 flex flex-wrap gap-1">
          {file.tags.split(',').slice(0, 3).map((tag, i) => (
            <span
              key={i}
              className="inline-block bg-gray-50 text-gray-500 text-[10px] px-1.5 py-0.5 rounded-md font-medium border border-gray-100"
            >
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

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
    </div>
  );
}
