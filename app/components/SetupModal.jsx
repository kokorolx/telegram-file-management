'use client';

import { useState, useEffect } from 'react';

export default function SetupModal({ onSetupComplete }) {
  const [showModal, setShowModal] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [userId, setUserId] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [useDefault, setUseDefault] = useState(true); // Always use default for now

  useEffect(() => {
    checkSetup();
  }, []);

  async function checkSetup() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();
      setSetupComplete(data.setupComplete);
      setShowModal(!data.setupComplete);
    } catch (err) {
      console.error('Error checking setup:', err);
      setShowModal(true);
    }
  }

  async function handleSetup(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = { setupToken, masterPassword };
      if (useDefault) {
          payload.useDefault = true;
          // Even if default is used, we might verify setupToken slightly differently or skip it?
          // Current backend logic: "Validate setup token ONLY if not using default"
          // So if useDefault is true, frontend doesn't Strictly need setupToken, BUT
          // backend logic says: if (!useDefault && setupToken !== SETUP_TOKEN)
          // So if useDefault is true, we can send empty setupToken??
          // Let's keep sending it if user entered it, but if useDefault is checked, maybe user didn't enter it?
          // The UI says "Setup Token is NOT required in this mode" when Checked.
          // So we should handle that.
      } else {
          payload.botToken = botToken;
          payload.userId = userId;
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      setShowModal(false);
      setSetupComplete(true);
      if (onSetupComplete) {
        onSetupComplete();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Required</h2>
         <p className="text-gray-600 mb-6">
           Set your master password to encrypt your vault.
         </p>

        <form onSubmit={handleSetup} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Bot Token and User ID inputs are disabled for now - using default config */}
          {/* TODO: Re-enable these fields in future if needed */}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Setup Token
            </label>
            <input
              type="password"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              placeholder="Setup token from environment"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Check .env.local for SETUP_TOKEN (default: default-setup-token)
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100 space-y-3">
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Create Master Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Vault Encryption Password"
                    disabled={loading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
             </div>

             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Master Password <span className="text-red-500">*</span>
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter Password"
                  disabled={loading}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-blue-500 ${
                    confirmPassword && masterPassword !== confirmPassword
                      ? 'border-red-300 focus:border-red-500 bg-red-50'
                      : 'border-gray-300'
                  }`}
                  required
                  minLength={6}
                />
                {confirmPassword && masterPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
             </div>

             <p className="text-xs text-amber-600">
               <strong>Important:</strong> Used to encrypt your files. Do not lose this!
             </p>
          </div>

          <button
            type="submit"
            disabled={loading || !masterPassword || masterPassword !== confirmPassword || (!useDefault && (!botToken || !userId || !setupToken)) }
            className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 text-blue-600 rounded border border-blue-600 bg-blue-600 flex items-center justify-center">
                   <span className="text-white text-xs">✓</span>
                </div>
                <label className="text-sm font-medium text-gray-700">
                    Using default configuration (.env)
                </label>
             </div>
             <p className="text-xs text-gray-500 pl-6">
                Using TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID from server environment.
             </p>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Need help? Check the setup guide or environment file.
          </p>
        </div>
      </div>
    </div>
  );
}
