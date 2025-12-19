import { useState } from 'react';

export default function SettingsDialog({ isOpen, onClose }) {
  const [setupToken, setSetupToken] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmMasterPassword, setConfirmMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ setupToken, masterPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSuccess('Master password updated successfully');
      setMasterPassword(''); // clear sensitive data
      setConfirmMasterPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-md p-6 rounded-2xl relative animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>

        <h2 className="text-2xl font-bold mb-6 text-white">Security Settings</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Admin Setup Token
            </label>
            <input
              type="password"
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500"
              placeholder="Enter setup token from .env"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              New Master Password
            </label>
            <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 pr-10"
                  placeholder="Enter new master password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                    {showPassword ? "🙈" : "👁️"}
                </button>
            </div>

            <label className="block text-sm font-medium text-gray-300 mb-1 mt-3">
              Confirm New Password
            </label>
            <input
              type={showPassword ? "text" : "password"}
              className={`w-full px-4 py-2 bg-white/5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-500 ${
                  confirmMasterPassword && masterPassword !== confirmMasterPassword ? 'border-red-500/50' : 'border-white/10'
              }`}
              placeholder="Re-enter new master password"
              value={confirmMasterPassword}
              onChange={(e) => setConfirmMasterPassword(e.target.value)}
              required
              minLength={8}
            />
             {confirmMasterPassword && masterPassword !== confirmMasterPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
             )}

            <p className="mt-2 text-xs text-gray-400">
              This password will be used to encrypt/decrypt all future encrypted files.
              Note: Changing it won&apos;t re-encrypt old files! (Feature limit)
            </p>
          </div>


          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading || !masterPassword || masterPassword !== confirmMasterPassword}
              className="px-6 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
