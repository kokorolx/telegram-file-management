'use client';

import { useState, useEffect } from 'react';

export default function SetupModal({ onSetupComplete }) {
  const [showModal, setShowModal] = useState(false);
  const [botToken, setBotToken] = useState('');
  const [userId, setUserId] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [useDefault, setUseDefault] = useState(false);

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
      const payload = { setupToken };
      if (useDefault) {
          payload.useDefault = true;
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

  if (!showModal && setupComplete) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Required</h2>
        <p className="text-gray-600 mb-6">
          Configure your Telegram bot credentials to get started.
        </p>

        <form onSubmit={handleSetup} className="space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telegram Bot Token
            </label>
            <input
              type="password"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="Get from @BotFather on Telegram"
              disabled={loading || useDefault}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              required={!useDefault}
            />
            <p className="text-xs text-gray-500 mt-1">
              Find it at https://t.me/botfather
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Telegram User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Find your ID with @userinfobot"
              disabled={loading || useDefault}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
              required={!useDefault}
            />
            <p className="text-xs text-gray-500 mt-1">
              Get it from https://t.me/userinfobot
            </p>
          </div>

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

          <button
            type="submit"
            disabled={loading || (!useDefault && (!botToken || !userId || !setupToken)) }
            className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-200">
             <div className="flex items-center gap-2 mb-2">
                <input
                    type="checkbox"
                    id="useDefault"
                    checked={useDefault}
                    onChange={(e) => setUseDefault(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="useDefault" className="text-sm font-medium text-gray-700 select-none">
                    Use default configuration (.env)
                </label>
             </div>
             {useDefault && (
                 <p className="text-xs text-gray-500 pl-6">
                    Will use TELEGRAM_BOT_TOKEN and TELEGRAM_USER_ID from server environment.
                    <strong>Setup Token is NOT required in this mode.</strong>
                 </p>
             )}
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
