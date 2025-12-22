'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import Dashboard from '../../components/Dashboard';
import BotManager from '../../components/BotManager';
import ResetMasterPasswordModal from '../../components/ResetMasterPasswordModal';
import S3BackupModal from '../../components/S3BackupModal';
import { config } from '@/lib/config';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard', path: '/settings/dashboard' },
  { id: 'security', label: '🛡️ Security', path: '/settings/security' },
  { id: 'bots', label: '🤖 Bot Manager', path: '/settings/bots' },
  { id: 'backup', label: '☁️ Backup', path: '/settings/backup' },
];

const ENTERPRISE_TAB = { id: 'enterprise', label: '🏢 Enterprise', path: '/settings/enterprise' };

export default function SettingsPage({ params }) {
  const resolvedParams = use(params);
  const tabSlug = resolvedParams?.tab?.[0] || 'dashboard';
  const router = useRouter();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const allTabs = config.isEnterprise ? [...TABS, ENTERPRISE_TAB] : TABS;
  const activeTab = allTabs.find(t => t.id === tabSlug) || allTabs[0];

  const handleTabChange = (tab) => {
    router.push(tab.path);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span>⚙️</span> Vault Settings
            </h1>
            <a
              href="/"
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-2"
            >
              ← Back to Vault
            </a>
          </div>
          <p className="text-slate-400 mt-2">Manage your vault configuration, security, and integrations.</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 mb-6 overflow-x-auto">
          {allTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab)}
              className={`px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab.id === tab.id
                  ? 'border-b-2 border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          {activeTab.id === 'dashboard' && <Dashboard />}
          {activeTab.id === 'bots' && <BotManager />}
          {activeTab.id === 'backup' && (
            <div className="space-y-6">
              <div className="bg-slate-700/50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <span>☁️</span> Cloud Backup Storage
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Configure S3-compatible backup storage (AWS S3, Cloudflare R2) to ensure your files are always available.
                </p>
                <button
                  onClick={() => setShowBackupModal(true)}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  Configure Backup Storage
                </button>
              </div>
              <div className="p-4 bg-amber-900/20 rounded-xl border border-amber-600/30">
                <p className="text-amber-200 text-sm">
                  ⚠️ <strong>Important:</strong> Your backup credentials are encrypted with your Master Password.
                  If you lose your Master Password, these credentials cannot be recovered.
                </p>
              </div>
            </div>
          )}
          {activeTab.id === 'security' && (
            <div className="space-y-6">
              <div className="bg-slate-700/50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <span>🗝️</span> Master Password
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Your master password is the key to your vault. If you forget it, you can reset it using your regular account login password—but existing encrypted files will be lost.
                </p>
                <button
                  onClick={() => setShowResetModal(true)}
                  className="px-6 py-2 bg-red-600/80 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
                >
                  Reset Master Password
                </button>
              </div>
              <div className="p-4 bg-blue-900/20 rounded-xl border border-blue-600/30">
                <p className="text-blue-200 text-sm">
                  ℹ️ We use AES-256-GCM encryption. The master password is used to derive your encryption key locally in your browser. Our servers only store a salted hash for verification.
                </p>
              </div>
            </div>
          )}
          {activeTab.id === 'enterprise' && (
            <div className="space-y-6">
              <div className="bg-slate-700/50 rounded-xl p-6">
                <h3 className="text-xl font-bold text-white mb-4">Enterprise Features Active</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Storage Backend</span>
                    <span className="font-mono bg-blue-600 px-2 py-0.5 rounded text-white">PROVISIONED</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Audit Logging</span>
                    <span className="font-mono bg-emerald-600 px-2 py-0.5 rounded text-white">ACTIVE</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">High Availability</span>
                    <span className="font-mono bg-purple-600 px-2 py-0.5 rounded text-white">REDIS-STORE</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ResetMasterPasswordModal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        onResetComplete={() => {
          alert('Master password reset successful.');
        }}
      />

      <S3BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />
    </div>
  );
}
