'use client';

import { useState, useEffect } from 'react';
import ResetMasterPasswordModal from './ResetMasterPasswordModal';

export default function PasswordPromptModal({ isOpen, onSubmit, onCancel, isLoading, fileName, onFileNameChange }) {
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setDisplayName('');
      setError('');
    } else if (fileName) {
      setDisplayName(fileName);
    }
  }, [isOpen, fileName]);

  const handleFileNameChange = (e) => {
    const newName = e.target.value;
    setDisplayName(newName);
    if (onFileNameChange) {
      onFileNameChange(newName);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || 'Invalid password');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-2">🔒 Enter Master Password</h2>
        <p className="text-sm text-gray-600 mb-4">
          Please enter your master password to upload files.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              File Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={handleFileNameChange}
              placeholder="File name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Extension cannot be changed</p>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Master Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter master password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
              disabled={isLoading}
            />
            {error && <p className="text-sm text-red-600 mt-1">{error}</p>}

            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline underline-offset-2"
              >
                Forgot master password?
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPassword('');
                setDisplayName('');
                onCancel();
              }}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Verifying...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>

      <ResetMasterPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          alert('Master password reset successful. Please use your new master password to proceed.');
        }}
      />
    </div>
  );
}
