import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';

export default function PreviewModal({ file, isOpen, onClose }) {
  const { masterPassword, isUnlocked, unlock } = useEncryption();
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
    loadSecure(masterPassword);

  }, [isOpen, file, isUnlocked, masterPassword]);

  async function loadSecure(password) {
        try {
            setLoading(true);
            setError(null);

            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: file.id, master_password: password })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to load secure preview");
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
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
      unlock(inputPassword);
      // Effect will trigger loadSecure
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
                    <div className="flex justify-center">
                    <video
                        src={secureSrc}
                        controls
                        autoPlay
                        className="max-w-full max-h-[70vh] rounded shadow-sm"
                    >
                        Your browser does not support the video tag.
                    </video>
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

                {!isImage && !isVideo && !isAudio && (
                    <div className="text-center p-8 bg-white rounded-xl shadow-sm">
                    <p className="text-6xl mb-4">📄</p>
                    <p className="text-gray-600 mb-4 font-medium">
                        Preview not available for this file type
                    </p>
                    {/* For downloading context, we already have the URL or can trigger download via parent */}
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
