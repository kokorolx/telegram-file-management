'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { deriveEncryptionKeyBrowser, verifyFileKey, fetchFilePartMetadata } from '@/lib/clientDecryption';
import { useEncryption } from '../contexts/EncryptionContext';

export default function FilePasswordOverrideModal({
  isOpen,
  onClose,
  file,
  onSuccess
}) {
  const { salt: globalSalt } = useEncryption();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Derive key from the entered password
      const key = await deriveEncryptionKeyBrowser(password, globalSalt);

      // 2. Fetch metadata if not provided
      const parts = await fetchFilePartMetadata(file.id);

      // 3. Verify key
      const isValid = await verifyFileKey(file, key, parts);

      if (isValid) {
        onSuccess(key, password);
        onClose();
        setPassword('');
      } else {
        setError('Incorrect password for this file.');
      }
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[99999] p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🛡️</span> Legacy File Access
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <p className="text-sm text-blue-800 font-medium">
              Your current master password could not decrypt <strong>{file.original_filename}</strong>.
              This file might have been encrypted with an older password.
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              File Password (Legacy)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the password used for this file"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              autoFocus
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 font-medium bg-red-50 p-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Unlock File'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
