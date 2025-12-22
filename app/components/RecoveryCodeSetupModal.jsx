'use client';

import { useState, useRef, useEffect } from 'react';

/**
 * RecoveryCodeSetupModal
 * 
 * Shown immediately after user completes master password setup during registration.
 * Auto-generates 10 recovery codes and guides user to save them.
 * Includes instructions on where to regenerate codes later.
 */
export default function RecoveryCodeSetupModal({ isOpen, onClose }) {
  const [codes, setCodes] = useState([]);
  const [codesConfirmed, setCodesConfirmed] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const modalRef = useRef(null);

  // Auto-generate codes when modal opens
  useEffect(() => {
    if (isOpen && codes.length === 0) {
      generateCodes();
    }
  }, [isOpen]);

  const generateCodes = async () => {
    setLoading(true);
    setError(false);
    setCodesConfirmed(false);
    
    try {
      // Use onboarding endpoint that only requires session auth
      const response = await fetch('/api/auth/recovery-codes/generate-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate recovery codes');
      }

      const data = await response.json();
      setCodes(data.codes || []);
    } catch (err) {
      console.error('Error generating codes:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

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
    const text = `RECOVERY CODES - SAVE THESE IN A SECURE LOCATION\n\nGenerated: ${new Date().toLocaleString()}\n\n${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}\n\nWARNING:\n- These codes are ONE-TIME USE only\n- Each code can be used once to reset your master password\n- After use, the code is burned and cannot be reused\n- Lost codes cannot be recovered\n- Store these codes securely (printed, written down, encrypted file, etc.)\n\nTO REGENERATE NEW CODES:\n1. Go to Settings (top right menu)\n2. Click Security tab\n3. Click "Generate New Codes"\n4. You'll need your login password and master password\n`;

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
            <p style="margin-top: 2cm;"><strong>TO REGENERATE NEW CODES:</strong></p>
            <ol>
              <li>Go to Settings (top right menu)</li>
              <li>Click Security tab</li>
              <li>Click "Generate New Codes"</li>
              <li>You'll need your login password and master password</li>
            </ol>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleConfirm = () => {
    if (codesConfirmed) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🎉</span> Account Setup Complete!
          </h2>
          <p className="text-green-100 text-sm mt-1">Now protect your vault with recovery codes</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Success Message */}
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <h3 className="font-bold text-green-900 mb-2 flex items-center gap-2">
              <span>✅</span> Master Password Set Successfully
            </h3>
            <p className="text-sm text-green-800">
              Your master password has been set. Now generate 10 recovery codes to protect your vault in case you forget your password.
            </p>
          </div>

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
          {codes.length > 0 && (
            <div>
              <h3 className="font-bold text-gray-900 mb-3">Your 10 Recovery Codes:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-4 rounded-xl border border-gray-200">
                {codes.map((code, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-white p-3 rounded border border-gray-300 hover:border-green-400 transition-colors"
                  >
                    <code className="font-mono text-sm font-bold text-gray-900 flex-1">
                      {code}
                    </code>
                    <button
                      onClick={() => handleCopyCode(code)}
                      className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium hover:bg-green-200 transition-colors flex-shrink-0"
                    >
                      {copiedId === code ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleDownloadCodes}
              disabled={codes.length === 0}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm disabled:opacity-50"
            >
              ⬇️ Download as Text
            </button>
            <button
              onClick={handlePrintCodes}
              disabled={codes.length === 0}
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium text-sm disabled:opacity-50"
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
                <span className="text-xs text-gray-600 mt-1 block">
                  I understand these codes are one-time use and will be burned after use.
                </span>
              </span>
            </label>
          </div>

          {/* Regeneration Instructions */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-800 space-y-2">
            <p className="font-bold text-indigo-900">💡 How to Regenerate Codes Later:</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Go to <strong>Settings</strong> (top right menu)</li>
              <li>Click the <strong>Security</strong> tab</li>
              <li>Scroll to "Recovery & Security" section</li>
              <li>Click <strong>"Generate New Codes"</strong></li>
              <li>Provide your login password and master password</li>
              <li>Your old codes will be automatically revoked, and you'll get 10 new ones</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            disabled={!codesConfirmed}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Skip for Now
          </button>
          <button
            onClick={handleConfirm}
            disabled={!codesConfirmed}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              codesConfirmed
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            ✓ Got It - Start Using My Vault
          </button>
        </div>
      </div>
    </div>
  );
}
