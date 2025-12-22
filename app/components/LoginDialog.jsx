import { useState } from 'react';
import { isEmailCollectionEnabled } from '@/lib/featureFlags';

export default function LoginDialog({ isOpen, onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

      const payload = isRegister
        ? { username, password, email }
        : (username ? { username, password } : { password }); // Support legacy master password login (no username)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isRegister) {
          setIsRegister(false);
          setError(null);
          // Auto-fill for convenience but don't auto-login yet to force password memory
          alert('Account created! Please log in.');
      } else {
          onLoginSuccess();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in transform transition-all">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-white opacity-10 transform scale-150 rotate-12 origin-top-right"></div>
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-lg">
               <span className="text-4xl">{isRegister ? '✨' : '🔐'}</span>
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              {isRegister ? 'Join Us' : 'Welcome Back'}
            </h2>
            <p className="text-blue-100 mt-2 text-sm font-medium opacity-90">
              {isRegister ? 'Create your secure cloud space' : 'Secure file access portal'}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pb-10">

          {/* Tabs */}
          <div className="flex p-1.5 bg-gray-100 rounded-xl mb-8 relative">
             <div
               className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out border border-gray-200 ${isRegister ? 'translate-x-[calc(100%+6px)]' : 'translate-x-0.5'}`}
             ></div>
             <button
                 type="button"
                 onClick={() => { setIsRegister(false); setError(null); }}
                 className={`flex-1 relative z-10 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${!isRegister ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
             >
                 Log In
             </button>
             <button
                 type="button"
                 onClick={() => { setIsRegister(true); setError(null); }}
                 className={`flex-1 relative z-10 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${isRegister ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
             >
                 Sign Up
             </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-shake">
                <span className="text-lg">⚠️</span> {error}
              </div>
            )}

            <div className="space-y-4">
                {(isRegister || username || !isRegister) && (
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Username</label>
                        <div className="relative group">
                            <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">👤</span>
                            <input
                              type="text"
                              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder-gray-400"
                              placeholder={isRegister ? "Choose a username" : "Username (Optional for admin)"}
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              required={isRegister}
                            />
                        </div>
                    </div>
                )}

                {isRegister && isEmailCollectionEnabled() && (
                    <div className="space-y-1.5 animate-fade-in">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Email <span className="text-gray-400 font-normal normal-case">(Optional)</span></label>
                        <div className="relative group">
                            <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">📧</span>
                            <input
                              type="email"
                              className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder-gray-400"
                              placeholder="For password reset"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide ml-1">Password</label>
                    <div className="relative group">
                        <span className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors">🔑</span>
                        <input
                          type="password"
                          className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-gray-700 font-medium placeholder-gray-400"
                          placeholder={isRegister ? "Min 6 characters" : "Password or Admin Token"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={isRegister ? 6 : 1}
                        />
                    </div>
                </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-lg shadow-lg shadow-blue-500/30 transform hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Processing...
                  </span>
              ) : (
                  isRegister ? 'Create Account' : 'Access Files'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 p-4 text-center border-t border-gray-100">
             <p className="text-xs text-gray-400">
                Securely encrypted & powered by Telegram
             </p>
        </div>
      </div>
    </div>
  );
}
