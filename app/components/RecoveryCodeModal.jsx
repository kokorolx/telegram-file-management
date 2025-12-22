'use client';

import { useState, useRef } from 'react';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';

export default function RecoveryCodeModal({ isOpen, codes, onClose, onConfirm }) {
  const { recoveryCodesEnabled } = useFeatureFlags();
  const [codesConfirmed, setCodesConfirmed] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const modalRef = useRef(null);

  // Feature flag check and conditional rendering - after all hooks
  if (!recoveryCodesEnabled || !isOpen || !codes || codes.length === 0) return null;

  const handleCopyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(code);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadCodes = () => {
    const text = `RECOVERY CODES - SAVE THESE IN A SECURE LOCATION\n\nGenerated: ${new Date().toLocaleString()}\n\n${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nWARNING:\n- These codes are ONE-TIME USE only\n- Each code can be used once to reset your master password\n- After use, the code is burned and cannot be reused\n- Lost codes cannot be recovered\n- Store these codes securely (printed, written down, encrypted file, etc.)\n`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recovery-codes-${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintCodes = () => {
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Recovery Codes</title>
          <style>
            body { font-family: monospace; margin: 2cm; }
            h1 { color: #dc2626; }
            .warning { background-color: #fee2e2; padding: 1cm; border-left: 3px solid #dc2626; margin: 1cm 0; }
            .codes { margin: 2cm 0; }
            .code { margin: 0.5cm 0; font-size: 14pt; }
            .footer { margin-top: 2cm; font-size: 10pt; color: #666; }
          </style>
        </head>
        <body>
          <h1>🔐 RECOVERY CODES</h1>
          <p>Generated: ${new Date().toLocaleString()}</p>
          
          <div class="warning">
            <strong>⚠️ CRITICAL:</strong> These codes are ONE-TIME USE only. Store them securely offline.
          </div>
          
          <div class="codes">
            ${codes.map((code, i) => `<div class="code">${i + 1}. ${code}</div>`).join('')}
          </div>
          
          <div class="footer">
            <p><strong>WARNING:</strong></p>
            <ul>
              <li>Each code is single-use for resetting your master password</li>
              <li>After use, the code is burned and unusable</li>
              <li>Lost codes cannot be recovered</li>
              <li>Store in a secure location (written down, printed, encrypted file)</li>
            </ul>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleConfirm = () => {
    if (codesConfirmed) {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🔐</span> Protect Your Vault
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Warning Box */}
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <h3 className="font-bold text-red-900 mb-2 flex items-center gap-2">
              <span>⚠️</span> Important: One-Time Use Codes
            </h3>
            <ul className="text-sm text-red-800 space-y-1 ml-6">
              <li>• These codes are <strong>ONE-TIME USE ONLY</strong></li>
              <li>• Each code can be used once to reset your master password</li>
              <li>• After using a code to reset, it is burned and cannot be reused</li>
              <li>• Lost codes cannot be recovered - store them securely</li>
              <li>• Codes expire in 1 year if unused</li>
            </ul>
          </div>

          {/* Codes Display */}
          <div>
            <h3 className="font-bold text-gray-900 mb-3">Your 10 Recovery Codes:</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
              {codes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white p-3 rounded border border-gray-300 hover:border-blue-400 transition-colors"
                >
                  <code className="font-mono text-sm font-bold text-gray-900 flex-1">
                    {code}
                  </code>
                  <button
                    onClick={() => handleCopyCode(code)}
                    className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium hover:bg-blue-200 transition-colors flex-shrink-0"
                  >
                    {copiedId === code ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadCodes}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
            >
              ⬇️ Download as Text
            </button>
            <button
              onClick={handlePrintCodes}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm"
            >
              🖨️ Print
            </button>
          </div>

          {/* Confirmation Checkbox */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={codesConfirmed}
                onChange={(e) => setCodesConfirmed(e.target.checked)}
                className="w-5 h-5 mt-0.5 accent-blue-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700">
                <strong>I have saved these codes in a secure location</strong> (written down, printed, saved to encrypted file, password manager, etc.)
                <br />
                <span className="text-xs text-gray-600 mt-1">
                  I understand these codes are one-time use and will be burned after use.
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            Skip for Now
          </button>
          <button
            onClick={handleConfirm}
            disabled={!codesConfirmed}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              codesConfirmed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            ✓ Got It - Access My Vault
          </button>
        </div>
      </div>
    </div>
  );
}
