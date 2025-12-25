'use client';

export default function LargeVideoWarningModal({ isOpen, fileName, fileSizeMB, onContinue, onCancel }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-lg font-bold text-amber-900">Large Video File</h2>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            <span className="font-medium">"{fileName}"</span> is <span className="font-bold text-amber-600">{fileSizeMB} MB</span> — larger than 200 MB.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium text-amber-900">Streaming not available for this file</p>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>✓ Progressive streaming is <span className="font-semibold">disabled</span></li>
              <li>✓ The entire file will <span className="font-semibold">download</span> before playback</li>
              <li>✓ This is necessary to avoid browser memory issues</li>
            </ul>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-3">
            <p className="text-sm font-medium text-blue-900">✨ Want HD Video Streaming?</p>
            <p className="text-xs text-blue-800">
              Upgrade to <span className="font-semibold">Self-host Pro</span> to unlock streaming for videos up to your storage limit.
            </p>
            <div className="flex gap-2">
              <a
                href="/pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded transition-colors"
              >
                View Pricing
              </a>
              <a
                href="https://github.com/kokorolx/telegram-file-management"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs font-semibold text-blue-600 bg-blue-100 hover:bg-blue-200 px-3 py-1.5 rounded transition-colors"
              >
                Self-host
              </a>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
          >
            Cancel Upload
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
