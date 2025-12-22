'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEncryption } from '../contexts/EncryptionContext';
import {
    fetchFilePartMetadata,
    fetchAndDecryptFullFile,
    createDecryptedStream
} from '@/lib/clientDecryption';
import { getSecureImage, cacheSecureImage, blobCache, getCachedOrDecrypt } from '@/lib/secureImageCache';
import Lightbox from 'yet-another-react-lightbox';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Slideshow from 'yet-another-react-lightbox/plugins/slideshow';
import Video from 'yet-another-react-lightbox/plugins/video';
import 'yet-another-react-lightbox/styles.css';
import 'yet-another-react-lightbox/plugins/thumbnails.css';

function getFileIcon(mimeType, filename) {
  if (!mimeType && !filename) return '📄';
  const type = (mimeType || '').toLowerCase();
  const name = (filename || '').toLowerCase();
  if (type.includes('word') || name.endsWith('.doc') || name.endsWith('.docx')) return '📝';
  if (type.includes('spreadsheet') || type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.csv')) return '📊';
  if (type.includes('presentation') || name.endsWith('.ppt') || name.endsWith('.pptx')) return '🎯';
  if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gzip')) return '📦';
  if (name.endsWith('.zip') || name.endsWith('.rar') || name.endsWith('.7z') || name.endsWith('.tar') || name.endsWith('.gz')) return '📦';
  if (type.includes('javascript') || type.includes('typescript') || name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.jsx') || name.endsWith('.tsx')) return '💻';
  if (type.includes('python') || name.endsWith('.py')) return '🐍';
  if (type.includes('json') || name.endsWith('.json')) return '📋';
  if (type.includes('xml') || name.endsWith('.xml')) return '🏷️';
  if (type.includes('css') || name.endsWith('.css')) return '🎨';
  if (type.includes('html') || name.endsWith('.html')) return '🌐';
  if (type.includes('text') || type.includes('plain') || name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown')) return '📄';
  if (type.includes('audio')) return '🎵';
  return '📄';
}

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

export default function FileLightbox({
    file,
    isOpen,
    onClose,
    onDecryptionError,
    customKey,
    shareToken = null,
    initialParts = null
}) {
  const { encryptionKey: globalKey, isUnlocked: globalUnlocked, unlock, masterPassword } = useEncryption();

  const encryptionKey = customKey || globalKey;
  const isUnlocked = !!customKey || globalUnlocked;
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [inputPassword, setInputPassword] = useState('');
  const isFetchingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && file) {
      if (!file.is_encrypted || isUnlocked) {
        loadContent();
      } else {
        setSlides([]);
        setLoading(false);
        setError(null);
      }
    }
  }, [isOpen, file, isUnlocked]);

  const loadContent = async () => {
    if (isFetchingRef.current) return;
    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      let url = null;

      if (file.is_encrypted) {
        if (!isUnlocked) {
          setLoading(false);
          return;
        }
        
        // Use getCachedOrDecrypt to prevent concurrent fetches
        const entry = await getCachedOrDecrypt(file.id, async () => {
          const parts = initialParts || await fetchFilePartMetadata(file.id, shareToken);
          const blob = await fetchAndDecryptFullFile(file, encryptionKey, parts, shareToken, !!customKey, masterPassword);

          // Force MIME type for PDF/Audio if needed
          let mimeType = blob.type;
          if (file.mime_type?.includes('pdf')) mimeType = 'application/pdf';

          const finalBlob = new Blob([blob], { type: mimeType });
          return URL.createObjectURL(finalBlob);
        });
        
        url = entry.url;
      } else {
        url = `/api/download?file_id=${file.id}`;
      }

      // Create slide based on mime type
      const isImage = file.mime_type?.startsWith('image/');
      const isVideo = file.mime_type?.startsWith('video/');
      const isAudio = file.mime_type?.startsWith('audio/');
      const isPDF = file.mime_type?.includes('pdf');

      let slide = {};
      if (isImage) {
        slide = { src: url, type: 'image' };
      } else if (isVideo) {
        slide = {
          type: 'video',
          width: 1280,
          height: 720,
          sources: [
            {
              src: url,
              type: file.mime_type,
            },
          ],
        };
      } else if (isAudio) {
        slide = {
          type: 'audio',
          src: url,
        };
      } else if (isPDF) {
        slide = {
          type: 'pdf',
          src: url,
        };
      } else {
        slide = {
          type: 'unsupported',
          src: url,
        };
      }

      setSlides([slide]);

      // Track view
      fetch(`/api/stats/file/${file.id}/view`, { method: 'POST' }).catch(err => console.error(err));

    } catch (err) {
      console.error('Lightbox load error:', err);
      if (err.message.includes('decrypt') || err.message.includes('auth')) {
        if (onDecryptionError) {
          onDecryptionError(err);
        } else {
          setError('Decryption failed. Your master password may be incorrect for this file.');
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!inputPassword) return;

    try {
      setLoading(true);
      const res = await fetch('/api/auth/verify-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: inputPassword })
      });
      const data = await res.json();

      if (data.success) {
        unlock(inputPassword, data.salt);
        setInputPassword('');
      } else {
        setError(data.error || "Invalid password");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const content = (
    <>
      {/* Loading State Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4" />
            <p>Processing...</p>
          </div>
        </div>
      )}

      {/* Unlock UI (Ported from PreviewModal) */}
      {file?.is_encrypted && !isUnlocked && !loading && (
        <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full animate-fade-in">
            <div className="text-6xl mb-6">🔒</div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">Unlock Vault</h3>
            <p className="text-gray-500 mb-6 font-medium text-sm">
              Please enter your <strong>Current Master Password</strong> to unlock the vault.
              <br/><br/>
              <span className="text-xs opacity-80">
                (If this file uses a legacy password, you will be prompted for it after unlocking)
              </span>
            </p>
            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                value={inputPassword}
                onChange={e => setInputPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all shadow-sm"
                placeholder="Master Password"
                autoFocus
              />
              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!inputPassword}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95 text-sm"
                >
                  Unlock & View
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* General Error Overlay (Non-Unlock) */}
      {error && !loading && (!file?.is_encrypted || isUnlocked) && (
        <div className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl">
            <div className="text-red-500 text-5xl mb-6">⚠️</div>
            <h3 className="text-xl font-bold mb-3 text-gray-900">Error Loading Preview</h3>
            <p className="text-gray-600 mb-8 font-medium">{error}</p>
            <button
              onClick={onClose}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all shadow-md active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {!loading && !error && slides.length > 0 && (
        <Lightbox
          open={isOpen}
          close={onClose}
          slides={slides}
          plugins={[Video, Zoom, Slideshow, Thumbnails]}
          portal={{ root: document.body }}
          render={{
            slide: ({ slide }) => {
              if (slide.type === 'pdf') {
                return (
                  <div className="w-full h-full flex items-center justify-center">
                    <iframe
                      src={slide.src}
                      className="w-full h-full bg-white border-0"
                      title={file.original_filename}
                    />
                  </div>
                );
              }
              if (slide.type === 'audio') {
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-900/50">
                    <div className="text-8xl mb-8 animate-pulse text-blue-400">🎵</div>
                    <audio
                      src={slide.src}
                      controls
                      autoPlay
                      className="w-full max-w-xl"
                    />
                    <p className="text-white mt-8 text-2xl font-bold tracking-tight">{file.original_filename}</p>
                    <p className="text-gray-400 mt-2">Audio Preview</p>
                  </div>
                );
              }
              if (slide.type === 'unsupported') {
                return (
                  <div className="text-white text-center p-12 bg-gray-900/40 rounded-3xl backdrop-blur-sm max-w-2xl mx-4">
                    <div className="text-8xl mb-8 shadow-indigo-500/20 drop-shadow-2xl">
                        {getFileIcon(file.mime_type, file.original_filename)}
                    </div>
                    <h3 className="text-2xl font-bold mb-4">{file.original_filename}</h3>
                    <p className="text-lg text-gray-300 mb-2">
                        {file.mime_type ? getFileTypeName(file.mime_type) : getFileTypeName(file.original_filename)}
                    </p>
                    <p className="text-sm opacity-60">Full preview is not available for this file type.</p>
                  </div>
                );
              }
              return undefined;
            },
          }}
        />
      )}
    </>
  );

  return createPortal(content, document.body);
}
