'use client';

import { useUser } from '../contexts/UserContext';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';

export default function RecoveryCodeWarningBanner({ onGenerateClick }) {
  const { recoveryCodesEnabled: hasRecoveryCodes, loadingRecoveryCodes } = useUser();
  const { recoveryCodesEnabled: flagEnabled } = useFeatureFlags();

  const handleDismiss = () => {
    // Could add localStorage persistence here if desired
  };

  // Feature flag check and conditional rendering - after all hooks
  if (!flagEnabled || loadingRecoveryCodes || hasRecoveryCodes) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg mb-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-3 flex-1">
          <span className="text-2xl">⚠️</span>
          <div>
            <h3 className="font-bold text-yellow-900 mb-1">
              No recovery codes yet
            </h3>
            <p className="text-sm text-yellow-800">
              Generate recovery codes now to protect your vault from permanent data loss. These are one-time use codes that let you reset your master password securely.
            </p>
          </div>
        </div>
        <div className="flex gap-2 ml-4 flex-shrink-0">
          <button
            onClick={onGenerateClick}
            className="px-4 py-2 bg-yellow-600 text-white rounded font-medium hover:bg-yellow-700 transition-colors text-sm whitespace-nowrap"
          >
            Generate Now
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-yellow-700 hover:bg-yellow-100 rounded transition-colors"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
