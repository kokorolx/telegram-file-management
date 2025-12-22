'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEncryption } from '../contexts/EncryptionContext';
import { unwrapKey, wrapKey } from '@/lib/envelopeCipher';

export default function ShareModal({ file, isOpen, onClose }) {
    const { encryptionKey, salt, isUnlocked, masterPassword } = useEncryption();
    const [loading, setLoading] = useState(false);
    const [sharing, setSharing] = useState(false);
    const [shareUrl, setShareUrl] = useState('');
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [expiryMinutes, setExpiryMinutes] = useState('10080');
    const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!isOpen || !mounted) return null;

    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    const estimateMigrationTime = () => {
        const speedMBps = 2.0; // Conservative estimate: 2MB/s
        const sizeMB = file.file_size / (1024 * 1024);
        const seconds = Math.max(5, Math.ceil(sizeMB / speedMBps));
        return formatTime(seconds);
    };

    const handleUpgrade = async () => {
        try {
            setSharing(true);
            setError('');
            setLoading(true);
            setShowUpgradeConfirm(false);

            // 1. Fetch parts
            const { fetchFilePartMetadata, createDecryptedStream } = await import('@/lib/clientDecryption');
            const parts = await fetchFilePartMetadata(file.id);

            // 2. Create decrypted stream
            const decryptedStream = await createDecryptedStream(file, encryptionKey, parts, null, false, masterPassword);

            // 3. Wrap this stream into a "File-like" object for the uploader
            const fileWrapper = {
                stream: () => decryptedStream,
                size: file.file_size,
                name: file.original_filename,
                type: file.mime_type
            };

            // 4. Trigger re-upload using the NEW envelope system
            const { encryptFileChunks } = await import('@/lib/browserUploadEncryption');

            await encryptFileChunks(
                fileWrapper,
                encryptionKey,
                (p, t, m) => console.log(`Upgrade: ${m} ${Math.round(p/t*100)}%`),
                file.folder_id,
                null, // abortSignal
                file.id // Update existing file
            );

            alert('Security upgrade completed! You can now share this file instantly.');
            window.location.reload();
        } catch (err) {
            console.error('Upgrade error:', err);
            setError('Upgrade failed: ' + err.message);
        } finally {
            setSharing(false);
            setLoading(false);
        }
    };

    const handleShare = async () => {
        try {
            setSharing(true);
            setError('');

            console.log('Generating share link for file:', {
                id: file.id,
                name: file.original_filename,
                version: file.encryption_version,
                hasEncryptedKey: !!file.encrypted_file_key,
                hasKeyIv: !!file.key_iv,
                hasEncryptionKey: !!encryptionKey,
                hasSalt: !!salt
            });

            let dek;
            if (file.encryption_version === 2) {
                dek = await unwrapKey(file.encrypted_file_key, encryptionKey, salt, file.key_iv);
            } else {
                throw new Error("This file needs a security upgrade before it can be shared instantly.");
            }

            let shareKey = '';
            let passwordHash = null;

            if (usePassword) {
                shareKey = password;
                const msgBuffer = new TextEncoder().encode(password);
                const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
            } else {
                shareKey = crypto.randomUUID();
            }

            const wrapped = await wrapKey(dek, shareKey, 'sharing-salt');

            const res = await fetch('/api/share/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: file.id,
                    wrappedKey: wrapped.wrappedKey,
                    iv: wrapped.iv,
                    isPasswordProtected: usePassword,
                    passwordHash: passwordHash,
                    expiryMinutes: parseInt(expiryMinutes)
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            let finalUrl = data.link;
            // Use browser origin to handle development ports correctly
            if (typeof window !== 'undefined') {
                finalUrl = `${window.location.origin}/share/${data.token}`;
            }

            if (!usePassword) {
                finalUrl += `#${shareKey}`;
            }

            setShareUrl(finalUrl);
        } catch (err) {
            console.error('Share error:', err);
            setError(err.message);
        } finally {
            setSharing(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isLegacy = file.encryption_version !== 2;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 flex items-center justify-between text-white">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span>🔗</span> Secure Share
                    </h2>
                    <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                            <p className="text-gray-600 font-bold italic animate-pulse">Upgrading security vault...</p>
                        </div>
                    ) : isLegacy ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-300">
                            {!showUpgradeConfirm ? (
                                <>
                                    <div className="text-5xl mb-6">🛡️</div>
                                    <h3 className="text-xl font-bold text-amber-900 mb-2">Security Upgrade Required</h3>
                                    <p className="text-amber-800 text-sm mb-8 leading-relaxed">
                                        This file uses our legacy encryption system. To enable instant secure sharing, we need to perform a one-time security upgrade.
                                    </p>
                                    <button
                                        disabled={!isUnlocked}
                                        className="w-full bg-amber-600 text-white px-6 py-4 rounded-2xl font-black text-lg hover:bg-amber-700 transition-all shadow-xl shadow-amber-600/20 active:scale-95 disabled:opacity-50 disabled:grayscale"
                                        onClick={() => setShowUpgradeConfirm(true)}
                                    >
                                        {isUnlocked ? 'Upgrade This File' : 'Postponed: Unlock Vault First'}
                                    </button>
                                    {!isUnlocked && (
                                        <p className="mt-4 text-[10px] font-black text-amber-600 uppercase tracking-widest animate-pulse">
                                            ⚠️ Master Key Required
                                        </p>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-bold text-amber-900">Confirm Security Upgrade</h3>
                                    <div className="bg-white/50 rounded-2xl p-4 border border-amber-100 flex items-center justify-between text-left">
                                        <div className="space-y-1">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Estimated Time</p>
                                            <p className="text-sm font-bold text-amber-900">~ {estimateMigrationTime()}</p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Process</p>
                                            <p className="text-[10px] text-amber-800 font-medium">Download → Decrypt → Re-upload</p>
                                        </div>
                                    </div>

                                    <p className="text-xs text-amber-700 italic">
                                        Your file contents are upgraded directly in your browser. The server never sees the plaintext.
                                    </p>

                                    <div className="flex gap-3">
                                        <button
                                            className="flex-1 bg-white border border-amber-200 text-amber-900 px-4 py-3 rounded-xl font-bold hover:bg-amber-100 transition-colors"
                                            onClick={() => setShowUpgradeConfirm(false)}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="flex-[2] bg-amber-600 text-white px-4 py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg active:scale-95"
                                            onClick={handleUpgrade}
                                        >
                                            Start Upgrade
                                        </button>
                                    </div>
                                    {error && <p className="text-red-600 text-xs font-bold">⚠️ {error}</p>}
                                </div>
                            )}
                        </div>
                    ) : shareUrl ? (
                        <div className="space-y-6 animate-in slide-in-from-bottom-4">
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                                <div className="text-4xl mb-3">✅</div>
                                <h3 className="text-lg font-bold text-green-900">Secure Link Generated</h3>
                                <p className="text-green-700 text-sm">Anyone with this link can view the file.</p>
                            </div>

                            <div className="flex gap-2">
                                <input
                                    readOnly
                                    value={shareUrl}
                                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none"
                                />
                                <button
                                    onClick={copyToClipboard}
                                    className={`${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-6 rounded-xl font-bold transition-all flex items-center gap-2 min-w-[100px] justify-center`}
                                >
                                    {copied ? (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Done!</span>
                                        </>
                                    ) : (
                                        'Copy'
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">📄</div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-gray-900 truncate">{file.original_filename}</h3>
                                    <p className="text-xs text-gray-500">Envelope Encryption Enabled</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl hover:bg-gray-50 transition-colors cursor-pointer"
                                     onClick={() => setUsePassword(!usePassword)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${usePassword ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                            {usePassword ? '🔑' : '🔓'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">Password Protection</p>
                                            <p className="text-xs text-gray-500">{usePassword ? 'Recipient must enter password' : 'Access via secret URL hash'}</p>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-6 rounded-full p-1 transition-colors ${usePassword ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${usePassword ? 'translate-x-6' : ''}`} />
                                    </div>
                                </div>

                                {usePassword && (
                                    <input
                                        type="password"
                                        placeholder="Enter Share Password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all animate-in slide-in-from-top-2"
                                    />
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase">Expiry</label>
                                        <select
                                            value={expiryMinutes}
                                            onChange={e => setExpiryMinutes(e.target.value)}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="5">5 Minutes</option>
                                            <option value="15">15 Minutes</option>
                                            <option value="30">30 Minutes</option>
                                            <option value="60">1 Hour</option>
                                            <option value="1440">24 Hours</option>
                                            <option value="10080">7 Days</option>
                                            <option value="43200">30 Days</option>
                                            <option value="0">Never</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
                                    ⚠️ {error}
                                </div>
                            )}

                            {!isUnlocked && (
                                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 animate-in fade-in slide-in-from-top-4">
                                    <div className="text-2xl">🔒</div>
                                    <div className="text-xs font-medium leading-relaxed">
                                        Vault is Locked. You must <span className="font-black underline italic">Unlock</span> before you can generate secure sharing links.
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleShare}
                                disabled={sharing || !isUnlocked || (usePassword && !password)}
                                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale"
                            >
                                {sharing ? 'Generating...' : isUnlocked ? 'Generate Secure Link' : 'Unlock Vault to Share'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
