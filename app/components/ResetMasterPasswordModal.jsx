'use client';

import { useState, useEffect } from 'react';

export default function ResetMasterPasswordModal({ isOpen, onClose, onResetComplete }) {
  const [loginPassword, setLoginPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasRecoveryCodes, setHasRecoveryCodes] = useState(false);
  const [checkingCodes, setCheckingCodes] = useState(true);

  useEffect(() => {
    if (isOpen) {
      checkRecoveryCodes();
    }
  }, [isOpen]);

  const checkRecoveryCodes = async () => {
    try {
      const response = await fetch('/api/auth/recovery-codes');
      if (response.ok) {
        const data = await response.json();
        setHasRecoveryCodes(data.enabled && data.codesRemaining > 0);
      }
    } catch (err) {
      console.error('Error checking recovery codes:', err);
    } finally {
      setCheckingCodes(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newMasterPassword !== confirmMasterPassword) {
      setError('New master passwords do not match');
      return;
    }

    if (newMasterPassword.length < 6) {
      setError('Master password should be at least 6 characters');
      return;
    }

    if (!recoveryCode) {
      setError('Recovery code is required');
      return;
    }

    if (!loginPassword) {
      setError('Login password is required');
      return;
    }

    setLoading(true);
    try {
      const body = {
        loginPassword,
        recoveryCode,
        newMasterPassword
      };

      const response = await fetch('/api/auth/reset-master-with-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset master password');
      }

      onResetComplete(data.salt);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>⚠️</span> Security Reset
          </h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl">
            <p className="text-sm text-red-800 font-medium">
              <strong>CRITICAL WARNING:</strong> Resetting your master password will change your encryption key.
              Any files already in your vault will become <strong>unreadable</strong> unless you have the old key.
            </p>
          </div>

          {!hasRecoveryCodes && !checkingCodes && (
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ <strong>No Recovery Codes:</strong> You don't have any active recovery codes. You must generate recovery codes first in Settings → Security before you can reset your master password.
              </p>
            </div>
          )}

          {/* Recovery Code Section */}
          {hasRecoveryCodes && !checkingCodes && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Recovery Code
                </label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  Enter one of your recovery codes
                </p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Confirm Login Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter your regular account password"
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                />
                <p className="text-xs text-gray-600 mt-1">
                  For identity verification
                </p>
              </div>
            </div>
          )}

          <div className="h-px bg-gray-100 my-2"></div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              New Master Password
            </label>
            <input
              type="password"
              value={newMasterPassword}
              onChange={(e) => setNewMasterPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Confirm New Master Password
            </label>
            <input
              type="password"
              value={confirmMasterPassword}
              onChange={(e) => setConfirmMasterPassword(e.target.value)}
              placeholder="Repeat new master password"
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
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
              disabled={loading || !hasRecoveryCodes || checkingCodes}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 'Reset Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
