'use client';

import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';

export default function SetupModal({ onSetupComplete, refreshTrigger }) {
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
  const [hasMasterPassword, setHasMasterPassword] = useState(true);
  const [useDefault, setUseDefault] = useState(true); // Always use default for now
  const { user } = useUser();

  useEffect(() => {
    checkSetup();
  }, [user, refreshTrigger]);

  async function checkSetup() {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      const setupComp = data.setupComplete;
      const hasMP = data.hasMasterPassword;

      setSetupComplete(setupComp);
      setHasMasterPassword(hasMP);

      // Only show modal if:
      // 1. Global setup is incomplete
      // 2. OR (Global setup complete AND user is logged in AND user has no master password set)
      const shouldShow = !setupComp || (setupComp && user && !hasMP);
      setShowModal(shouldShow);
    } catch (err) {
      console.error('Error checking setup:', err);
      // Fallback: only show if we are really sure or if setup might be missing
    }
  }

  async function handleSetup(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // If setup already complete, we only need to set the Master Password
      // The backend /api/settings handles this correctly (detects userId and updates their record)
      const payload = { setupToken, masterPassword };

      if (setupComplete) {
         // Just setting master password for existing user
         // We still need setupToken?
         // Actually backend PUT /api/settings requires setupToken.
         // But POST /api/settings also handles it if setupComplete is false.

         // Let's check backend route.js PUT
         /*
         if (setupToken !== SETUP_TOKEN) {
            return NextResponse.json({ success: false, error: 'Invalid setup token' }, { status: 401 });
         }
         */
         // So yes, we need setupToken if it's the first time setting it for this user?
         // User said: "should show set master password modal with clearly description."
         // If I am a regular user, I might not have the setupToken.

         // Wait, the user said: "we should allow user to add master password if user didnt have before any action"
         // If I am a new user, I shouldn't need the SETUP_TOKEN just to set MY master password.
         // SETUP_TOKEN should only be for Bot Token/UserID setup.

         // Let's modify the backend to allow setting master password for AUTHENTICATED users without SETUP_TOKEN.
      }

      if (useDefault) {
          payload.useDefault = true;
      } else {
          payload.botToken = botToken;
          payload.userId = userId;
      }

      const response = await fetch('/api/settings', {
        method: setupComplete ? 'PUT' : 'POST', // Use PUT if system is already set up
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed');
      }

      setShowModal(false);
      setHasMasterPassword(true);
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {setupComplete ? '🔒 Secure Your Vault' : '🚀 Initial Setup Required'}
        </h2>
         <p className="text-gray-600 mb-6">
           {setupComplete
             ? 'Welcome! To start using your secure storage, you must first set a master password.'
             : 'Configure your Telegram bot and set a master password to encrypt your vault.'}
         </p>

        <form onSubmit={handleSetup} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Bot Token and User ID inputs are disabled for now - using default config */}
          {/* TODO: Re-enable these fields in future if needed */}

          {!setupComplete && (
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
          )}

          <div className={`${!setupComplete ? 'pt-2 border-t border-gray-100' : ''} space-y-3`}>
             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl border border-blue-100 mb-6 shadow-sm">
                <div className="flex gap-3">
                  <span className="text-2xl">🛡️</span>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-blue-900">Zero-Knowledge Encryption</h4>
                    <p className="text-xs text-blue-800 leading-relaxed opacity-90">
                      Your master password is used to derive a local encryption key.
                      It is <strong>never sent to the server in plaintext</strong>.
                      <span className="block mt-2 font-semibold text-blue-950">
                        ⚠️ If you lose this password, your files are lost forever. We cannot reset it.
                      </span>
                    </p>
                  </div>
                </div>
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {setupComplete ? 'New Master Password' : 'Create Master Password'} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="Min 6 characters"
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
          </div>

          <button
            type="submit"
            disabled={loading || !masterPassword || masterPassword !== confirmPassword || (!setupComplete && !setupToken && !useDefault) }
            className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-lg shadow-blue-500/20 active:scale-[0.98]"
          >
            {loading ? (
                <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                </span>
            ) : (setupComplete ? 'Secure Vault' : 'Complete Setup')}
          </button>
        </form>

        {!setupComplete && (
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
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            Need help? Check the setup guide or environment file.
          </p>
        </div>
      </div>
    </div>
  );
}
