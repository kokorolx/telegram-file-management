'use client';

import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import RecoveryCodeModal from './RecoveryCodeModal';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';

export default function RecoveryCodeSettings() {
  const { recoveryCodeStatus, loadingRecoveryCodes, refreshRecoveryCodeStatus } = useUser();
  const { recoveryCodesEnabled, loading: flagsLoading } = useFeatureFlags();
  const [codes, setCodes] = useState([]);
  const [error, setError] = useState('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatedCodes, setGeneratedCodes] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revokePassword, setRevokePassword] = useState('');
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    if (recoveryCodeStatus?.codes) {
      setCodes(recoveryCodeStatus.codes);
    }
  }, [recoveryCodeStatus]);

  // Feature flag check - after all hooks
  if (!recoveryCodesEnabled) return null;

  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    setGeneratingCodes(true);
    setError('');

    try {
      const response = await fetch('/api/auth/recovery-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginPassword, masterPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recovery codes');
      }

      setGeneratedCodes(data.codes);
      setLoginPassword('');
      setMasterPassword('');
      setShowPasswordInput(false);
      setShowGenerateModal(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setGeneratingCodes(false);
    }
  };

  const handleCodeGenerationComplete = async () => {
    setGeneratedCodes(null);
    setShowGenerateModal(false);
    await refreshRecoveryCodeStatus();
  };

  const handleRevokeCodes = async (e) => {
    e.preventDefault();
    setRevoking(true);
    setError('');

    try {
      const response = await fetch('/api/auth/recovery-codes/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginPassword: revokePassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke recovery codes');
      }

      setRevokePassword('');
      setShowRevokeConfirm(false);
      await refreshRecoveryCodeStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setRevoking(false);
    }
  };

  if (loadingRecoveryCodes) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Recovery & Security</h3>
        <p className="text-sm text-gray-600">
          Manage your recovery codes for master password reset.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Status Card */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Recovery Codes Status</span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                recoveryCodeStatus?.enabled
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {recoveryCodeStatus?.enabled ? '✓ Enabled' : '○ Disabled'}
            </span>
          </div>

          {recoveryCodeStatus?.enabled && (
            <>
              <div className="border-t border-blue-200 pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Generated</span>
                  <span className="font-mono text-gray-900">
                    {recoveryCodeStatus.generatedAt
                      ? new Date(recoveryCodeStatus.generatedAt).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Expires</span>
                  <span className="font-mono text-gray-900">
                    {recoveryCodeStatus.expiresAt
                      ? new Date(recoveryCodeStatus.expiresAt).toLocaleDateString()
                      : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Remaining</span>
                  <span className="font-mono font-bold text-blue-600">
                    {recoveryCodeStatus.codesRemaining}/{recoveryCodeStatus.totalCodes}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Codes List */}
      {recoveryCodeStatus?.enabled && codes.length > 0 && (
        <div>
          <h4 className="font-bold text-gray-900 mb-3">Your Codes</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {codes.map((code, index) => (
              <div
                key={code.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200 text-sm"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="text-gray-500 w-6 text-center">{index + 1}.</span>
                  <code className="font-mono text-gray-900">{code.display}</code>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    code.used ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}
                >
                  {code.used ? 'Used' : 'Available'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {!showPasswordInput ? (
          <>
            {recoveryCodeStatus?.enabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                ℹ️ <strong>Generating new codes will revoke your current codes.</strong> You'll have a fresh set of 10 codes.
              </div>
            )}
            <button
              onClick={() => setShowPasswordInput(true)}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              🔄 {recoveryCodeStatus?.enabled ? 'Regenerate Codes' : 'Generate Codes'}
            </button>
            {recoveryCodeStatus?.enabled && (
              <button
                onClick={() => setShowRevokeConfirm(true)}
                className="w-full px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium"
              >
                🗑️ Revoke All Codes
              </button>
            )}
          </>
        ) : null}
      </div>

      {/* Password Input for Generate */}
      {showPasswordInput && !showRevokeConfirm && (
        <form onSubmit={handleGenerateCodes} className="bg-gray-50 p-4 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Login Password
            </label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Enter your login password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Master Password
            </label>
            <input
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Enter your master password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={generatingCodes || !loginPassword || !masterPassword}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors font-medium text-sm"
            >
              {generatingCodes ? 'Generating...' : 'Generate Codes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPasswordInput(false);
                setLoginPassword('');
                setMasterPassword('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Revoke Confirmation */}
      {showRevokeConfirm && (
        <form onSubmit={handleRevokeCodes} className="bg-red-50 p-4 rounded-lg space-y-3 border border-red-200">
          <p className="text-sm text-red-800 font-medium">
            ⚠️ This will revoke all unused recovery codes. You will need to generate new codes afterward.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Login Password
            </label>
            <input
              type="password"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
              placeholder="Enter your login password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={revoking || !revokePassword}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 transition-colors font-medium text-sm"
            >
              {revoking ? 'Revoking...' : 'Revoke All Codes'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRevokeConfirm(false);
                setRevokePassword('');
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Recovery Code Modal */}
      <RecoveryCodeModal
        isOpen={showGenerateModal}
        codes={generatedCodes}
        onClose={() => {
          setGeneratedCodes(null);
          setShowGenerateModal(false);
        }}
        onConfirm={handleCodeGenerationComplete}
      />

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
        <p className="font-medium text-blue-900">💡 About Recovery Codes</p>
        <ul className="list-disc list-inside space-y-1 text-gray-600">
          <li>Recovery codes are one-time use tokens for resetting your master password</li>
          <li>Each code can be used once, then it's burned</li>
          <li>Store codes securely: written down, printed, or in a password manager</li>
          <li>Codes expire after 1 year if unused</li>
          <li>Lost codes cannot be recovered</li>
        </ul>
      </div>
    </div>
  );
}
