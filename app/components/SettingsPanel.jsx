import { useState } from 'react';
import Dashboard from './Dashboard';
import BotManager from './BotManager';
import ResetMasterPasswordModal from './ResetMasterPasswordModal';

export default function SettingsPanel({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showResetModal, setShowResetModal] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span>⚙️</span> Vault Settings
            </h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                activeTab === 'dashboard'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Dashboard
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                activeTab === 'security'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🛡️ Security
            </button>
            <button
              onClick={() => setActiveTab('bots')}
              className={`flex-1 px-4 py-3 font-medium transition-colors text-center ${
                activeTab === 'bots'
                  ? 'border-b-2 border-blue-600 text-blue-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              🤖 Bot Manager
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'dashboard' && <Dashboard />}
            {activeTab === 'bots' && <BotManager />}
            {activeTab === 'security' && (
              <div className="space-y-6 animate-fade-in">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <span>🗝️</span> Master Password
                  </h3>
                  <p className="text-slate-600 text-sm mb-6">
                    Your master password is the key to your vault. If you forget it, you can reset it using your regular account login password—but keep in mind that existing encrypted files will be lost.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">Security Reset</p>
                      <p className="text-slate-500">Reset master password using account login</p>
                    </div>
                    <button
                      onClick={() => setShowResetModal(true)}
                      className="w-full sm:w-auto px-6 py-2 bg-red-50 text-red-600 hover:bg-red-100 font-bold rounded-xl transition-all border border-red-100"
                    >
                      Reset Key
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                  <span className="text-xl">ℹ️</span>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    We use AES-256-GCM encryption. The master password is used to derive your specific encryption key locally in your browser. Our servers only store a salted hash of your master password for verification.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ResetMasterPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={(newSalt) => {
          // You could optionally trigger a reload or context update here
          alert('Master password reset successful. Your vault is now using a new encryption key.');
        }}
      />
    </>
  );
}
