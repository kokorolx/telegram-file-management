import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { blobCache } from '@/lib/secureImageCache';
import VideoPlayer from './VideoPlayer';
import { deriveEncryptionKeyBrowser, fetchAndDecryptFullFile, fetchFilePartMetadata } from '@/lib/clientDecryption';

// Helper function to get file icon based on mime type
function getFileIcon(mimeType, filename) {
  if (!mimeType && !filename) return '📄';

  const type = (mimeType || '').toLowerCase();
  const name = (filename || '').toLowerCase();

  // Documents
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
  if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return '📊';
  if (type.includes('presentation') || name.endsWith('.ppt') || name.endsWith('.pptx')) return '🎯';

  // Archives
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gzip')) return '📦';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar') || name.endsWith('.gz')) return '📦';

  // Code
  if (type.includes('javascript') || type.includes('typescript') || name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx')) return '💻';
  if (type.includes('python') || name.endsWith('.py')) return '🐍';
  if (type.includes('json') || name.endsWith('.json')) return '📋';
  if (type.includes('xml') || name.endsWith('.xml')) return '🏷️';
  if (type.includes('css') || name.endsWith('.css')) return '🎨';
  if (type.includes('html') || name.endsWith('.html')) return '🌐';

  // Text
  if (type.includes('text') || type.includes('plain') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) return '📄';

  // Audio (fallback)
  if (type.includes('audio')) return '🎵';

  // Default
  return '📄';
}

// Helper function to get readable file type name
function getFileTypeName(mimeTypeOrFilename) {
  const input = (mimeTypeOrFilename || '').toLowerCase();

  if (input.includes('word') || input.endsWith('.doc') || input.endsWith('.docx')) return 'Word Document';
  if (input.includes('spreadsheet') || input.includes('excel') || input.endsWith('.xls') || input.endsWith('.xlsx') || input.endsWith('.csv')) return 'Spreadsheet';
  if (input.includes('presentation') || input.endsWith('.ppt') || input.endsWith('.pptx')) return 'Presentation';
  if (input.includes('zip')) return 'ZIP Archive';
  if (input.includes('rar')) return 'RAR Archive';
  if (input.includes('7z')) return '7Z Archive';
  if (input.includes('tar') || input.includes('gzip')) return 'TAR Archive';
  if (input.includes('javascript') || input.endsWith('.js') || input.endsWith('.jsx')) return 'JavaScript File';
  if (input.includes('typescript') || input.endsWith('.ts') || input.endsWith('.tsx')) return 'TypeScript File';
  if (input.includes('python') || input.endsWith('.py')) return 'Python File';
  if (input.includes('json')) return 'JSON File';
  if (input.includes('xml')) return 'XML File';
  if (input.includes('css')) return 'CSS File';
  if (input.includes('html')) return 'HTML File';
  if (input.includes('text') || input.includes('plain') || input.endsWith('.txt') || input.endsWith('.md')) return 'Text File';
  if (input.endsWith('.markdown')) return 'Markdown File';
  if (input.includes('audio')) return 'Audio File';
  if (input.includes('application')) return 'Application File';

  return 'File';
}

export default function PreviewModal({ file, isOpen, onClose }) {
  const { masterPassword, encryptionKey, salt, isUnlocked, unlock } = useEncryption();
  const [mounted, setMounted] = useState(false);
  const [secureSrc, setSecureSrc] = useState(null);
  const [inputPassword, setInputPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Fetch content
  useEffect(() => {
    if (!isOpen || !file) return;

    // Reset
    setSecureSrc(null);
    setError(null);
    setInputPassword('');

    // 1. Unencrypted
    if (!file.is_encrypted) {
      setSecureSrc(`/api/download?file_id=${file.id}`);
      return;
    }

    // 2. Encrypted but locked
    if (!isUnlocked) {
        // Wait for user input
        return;
    }

    // 3. Encrypted and Unlocked -> Fetch Secure Blob
    if (encryptionKey) {
        loadSecure(encryptionKey);
    }

  }, [isOpen, file, isUnlocked, masterPassword, encryptionKey]);

  async function loadSecure(key) {
        try {
            setLoading(true);
            setError(null);

            // For video: Use VideoPlayer component for progressive streaming
            // VideoPlayer handles its own fetching and decryption
            if (file?.mime_type?.startsWith('video/')) {
                setSecureSrc('use-video-player'); // Signal to use VideoPlayer
                setLoading(false);
                return;
            }

            // For audio: Decrypt in browser using client-side decryption
            if (file?.mime_type?.startsWith('audio/')) {
                try {
                    // 2. Fetch part metadata
                    const partMetadata = await fetchFilePartMetadata(file.id);

                    // 3. Decrypt entire audio file in browser
                    const decryptedBlob = await fetchAndDecryptFullFile(file.id, key, partMetadata);

                    // Create blob URL and cache
                    const url = URL.createObjectURL(decryptedBlob);
                    blobCache.set(file.id, { url, timestamp: Date.now() });
                    setSecureSrc(url);
                } catch (err) {
                    setError(`Audio decryption failed: ${err.message}`);
                }
                setLoading(false);
                return;
            }

            // For other file types: Decrypt in browser (images, PDFs, documents, etc.)
            // 1. Check Cache First
            if (blobCache.has(file.id)) {
                setSecureSrc(blobCache.get(file.id).url);
                setLoading(false);
                return;
            }

            // 2. Fetch unencrypted part metadata
            const partMetadata = await fetchFilePartMetadata(file.id);

            // 3. Decrypt entire file in BROWSER (chunks fetched encrypted, decrypted locally)
            const decryptedBlob = await fetchAndDecryptFullFile(file.id, key, partMetadata);

            // 5. Force correct MIME type for PDFs
            const mimeType = file.mime_type?.includes('pdf') ? 'application/pdf' : decryptedBlob.type;
            const finalBlob = new Blob([decryptedBlob], { type: mimeType });
            const url = URL.createObjectURL(finalBlob);

            // 6. Save to Cache
            blobCache.set(file.id, { url, timestamp: Date.now() });

            setSecureSrc(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

  const handleUnlock = (e) => {
      e.preventDefault();
      if (!inputPassword) return;

      // We need to fetch salt first if we want to unlock from here
      // But usually user is already logged in and context has salt?
      // If not, we fetch from /api/settings
      fetch('/api/auth/verify-master', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: inputPassword })
      }).then(res => res.json()).then(data => {
          if (data.success) {
              unlock(inputPassword, data.salt);
          } else {
              setError(data.error || "Invalid password");
          }
      });
  };


  if (!isOpen || !mounted) return null;

  const isImage = file?.mime_type?.startsWith('image/');
  const isVideo = file?.mime_type?.startsWith('video/');
  const isAudio = file?.mime_type?.startsWith('audio/');

  const modalContent = (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[9999] p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg max-w-4xl w-full max-h-[90vh] overflow-auto animate-fade-in" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {file?.original_filename}
            </h3>
            <p className="text-sm text-gray-500">
              {(file?.file_size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold p-2"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex items-center justify-center min-h-[400px] bg-gray-50">

           {/* Unlock UI */}
           {file?.is_encrypted && !isUnlocked && (
               <div className="bg-white p-6 rounded-xl shadow-lg text-center max-w-sm w-full">
                   <div className="text-4xl mb-4">🔒</div>
                   <h3 className="text-lg font-semibold mb-2">Encrypted File</h3>
                   <p className="text-gray-500 mb-4 text-sm">Enter master password to view.</p>
                   <form onSubmit={handleUnlock}>
                       <input
                           type="password"
                           value={inputPassword}
                           onChange={e => setInputPassword(e.target.value)}
                           className="w-full border border-gray-300 rounded px-3 py-2 mb-3"
                           placeholder="Master Password"
                           autoFocus
                       />
                       <button
                           type="submit"
                           disabled={!inputPassword}
                           className="w-full bg-blue-600 text-white rounded px-3 py-2 font-medium hover:bg-blue-700 disabled:opacity-50"
                       >
                           Unlock
                       </button>
                   </form>
               </div>
           )}

           {loading && <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>}

           {error && (
               <div className="text-red-500 text-center">
                   <p className="text-xl mb-2">🔒</p>
                   <p>{error}</p>
               </div>
           )}

           {!loading && !error && secureSrc && (
               <>
                {isImage && (
                    <div className="flex justify-center">
                    <img
                        src={secureSrc}
                        alt={file.original_filename}
                        className="max-w-full max-h-[70vh] rounded shadow-sm object-contain"
                    />
                    </div>
                )}

                {isVideo && (
                    <div className="flex justify-center w-full">
                        <VideoPlayer
                            fileId={file.id}
                            fileName={file.original_filename}
                            fileSize={file.file_size}
                            mimeType={file.mime_type}
                        />
                    </div>
                )}

                {isAudio && (
                    <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-xl shadow-sm">
                    <div className="text-6xl animate-bounce">🎵</div>
                    <audio
                        src={secureSrc}
                        controls
                        autoPlay
                        className="w-full max-w-md"
                    />
                    </div>
                )}

                {file.mime_type?.includes('pdf') && (
                    <div className="w-full h-[75vh]">
                        <iframe
                            src={secureSrc}
                            className="w-full h-full rounded shadow-sm border border-gray-200"
                            title={file.original_filename}
                        />
                    </div>
                )}

                {!isImage && !isVideo && !isAudio && !file.mime_type?.includes('pdf') && (
                    <div className="text-center p-8 bg-white rounded-xl shadow-sm w-full">
                        {/* File Type Icon Thumbnail */}
                        <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center shadow-md">
                            <div className="text-6xl">{getFileIcon(file.mime_type, file.original_filename)}</div>
                        </div>
                        <p className="text-gray-600 mb-2 font-medium">
                            {file.mime_type ? getFileTypeName(file.mime_type) : getFileTypeName(file.original_filename)}
                        </p>
                        <p className="text-sm text-gray-500">
                            Preview not available for this file type
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            {file.original_filename}
                        </p>
                    </div>
                )}
               </>
           )}
        </div>

        {/* Footer */}
        {file?.description && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
            <p className="text-gray-700">{file.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex gap-2">
            {/* The simple download link won't work for Encrypted files anymore without JS */}
            {/* We will just rely on the parent download button or reimplement it here if needed */}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-300 text-gray-900 px-4 py-2 rounded hover:bg-gray-400 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
