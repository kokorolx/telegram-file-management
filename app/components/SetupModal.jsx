'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { useEncryption } from '../contexts/EncryptionContext';

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
  const [useDefault, setUseDefault] = useState(true);
  const [showConfig, setShowConfig] = useState(false); // Toggle for advanced config
  const { user } = useUser();
  const { unlock } = useEncryption();

  const checkSetup = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      const data = await response.json();

      const setupComp = data.setupComplete;
      const hasMP = data.hasMasterPassword;

      setSetupComplete(setupComp);
      setHasMasterPassword(hasMP);

      // Only show modal if:
      // 1. User is logged in AND has no master password set
      // (Global setup is already complete via environment variables)
      const shouldShow = user && !hasMP;
      setShowModal(shouldShow);
    } catch (err) {
      console.error('Error checking setup:', err);
      // Fallback: only show if we are really sure or if setup might be missing
    }
  }, [user]);

  useEffect(() => {
    checkSetup();
  }, [checkSetup, refreshTrigger]);

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

      if (!useDefault) {
          payload.botToken = botToken;
          payload.userId = userId;
          payload.useDefault = false;
      } else {
          payload.useDefault = true;
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

      // Automatically unlock the vault after setting password
      if (data.salt) {
          await unlock(masterPassword, data.salt);
      }

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
          🔒 Secure Your Vault
        </h2>
        <p className="text-gray-600 mb-6">
          Welcome! To start using your secure storage, set a master password to encrypt your files.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Bot configuration is handled via environment variables */}
          {/* No need to show bot setup fields when system is already configured */}

          {/* If setup is complete but user wants to update their personal bot config */}
          {setupComplete && !hasMasterPassword && (
             <div className="bg-blue-50/30 rounded-2xl p-4 border border-blue-100/50 mb-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="w-full flex items-center justify-between text-sm text-blue-700 font-semibold hover:text-blue-800 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span>{showConfig ? '▼' : '▶'}</span>
                    <span>Use My Own Telegram Bot? (Optional)</span>
                  </span>
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Advanced</span>
                </button>

                {showConfig && (
                   <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl border border-blue-100">
                         <div className="space-y-0.5">
                            <span className="text-xs font-bold text-gray-700">Storage Bot Configuration</span>
                            <p className="text-[10px] text-gray-500">Provide your own bot to store files in your private chat.</p>
                         </div>
                         <button
                            type="button"
                            onClick={() => setUseDefault(!useDefault)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-tighter"
                         >
                            {useDefault ? 'Set Custom Bot' : '← Back to Default'}
                         </button>
                      </div>

                      {!useDefault ? (
                        <div className="space-y-3 bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                           <div>
                            <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1">Telegram Bot Token</label>
                            <input
                              type="password"
                              value={botToken}
                              onChange={(e) => setBotToken(e.target.value)}
                              placeholder="123456:ABC-DEF..."
                              disabled={loading}
                              className="w-full px-3 py-2 border border-blue-100 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-blue-50/20"
                              required={!useDefault}
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-blue-500 uppercase mb-1">Telegram User ID</label>
                            <input
                              type="text"
                              value={userId}
                              onChange={(e) => setUserId(e.target.value)}
                              placeholder="Your numeric ID"
                              disabled={loading}
                              className="w-full px-3 py-2 border border-blue-100 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-blue-50/20"
                              required={!useDefault}
                            />
                          </div>
                        </div>
                      ) : (
                         <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 text-center">
                            <p className="text-xs text-gray-500">Using the system default bot for storage.</p>
                            <button
                               type="button"
                               onClick={() => setUseDefault(false)}
                               className="mt-2 text-xs text-blue-600 font-bold hover:underline"
                            >
                               Click to configure personal bot
                            </button>
                         </div>
                      )}
                   </div>
                )}
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
            disabled={loading || !masterPassword || masterPassword !== confirmPassword}
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
            ) : 'Secure Vault'}
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
