'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { unwrapKey } from '@/lib/envelopeCipher';
import { fetchFilePartMetadata, fetchAndDecryptFullFile } from '@/lib/clientDecryption';
import Lightbox from '@/app/components/Lightbox';

export default function GuestSharePage() {
    const params = useParams();
    const token = params.token;
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [password, setPassword] = useState('');
    const [needsPassword, setNeedsPassword] = useState(false);
    const [shareKey, setShareKey] = useState('');
    const [decryptedKey, setDecryptedKey] = useState(null);
    const [parts, setParts] = useState([]);
    const [showLightbox, setShowLightbox] = useState(false);

    const fetchShareMetadata = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/share/${token}`);
            const data = await res.json();

            if (!res.ok) throw new Error(data.error);

            setFile(data.file);
            setNeedsPassword(data.isPasswordProtected);
            setParts(data.parts || []);

            // If not password protected and we have the hash key, attempt instant decryption
            const hash = window.location.hash.slice(1);
            if (!data.isPasswordProtected && hash) {
                try {
                    const dek = await unwrapKey(data.wrappedKey, hash, 'sharing-salt', data.keyIv);
                    setDecryptedKey(dek);
                    setFile(prev => ({
                        ...prev,
                        encrypted_file_key: data.wrappedKey,
                        key_iv: data.keyIv
                    }));
                } catch (err) {
                    console.error('Failed to unwrap with URL hash:', err);
                    setError('Invalid or corrupted share link.');
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        // Extract ShareKey from hash if present
        const hash = window.location.hash.slice(1);
        if (hash) {
            setShareKey(hash);
        }
        fetchShareMetadata();
    }, [fetchShareMetadata]);

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError('');

            // 1. Verify password hash with server
            const msgBuffer = new TextEncoder().encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
            const passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

            const verifyRes = await fetch(`/api/share/${token}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ passwordHash })
            });

            if (!verifyRes.ok) throw new Error('Incorrect password');
            const data = await verifyRes.json();

            // 2. Unwrap DEK with password
            const dek = await unwrapKey(data.wrappedKey, password, 'sharing-salt', data.keyIv);
            setDecryptedKey(dek);
            setFile(data.file);
            setParts(data.parts || []);
            setNeedsPassword(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !file) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Bypassing firewalls and fetching secret bytes...</p>
                </div>
            </div>
        );
    }

    if (error && !file) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
                    <div className="text-6xl mb-6">🚫</div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-500 mb-8">{error}</p>
                    <a href="/" className="inline-block bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition-all">
                        Go Home
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-white">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-10 text-white text-center">
                    <div className="w-24 h-24 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center text-5xl mx-auto mb-6 shadow-2xl">
                        🔒
                    </div>
                    <h1 className="text-3xl font-black tracking-tight mb-2">Secure Shared File</h1>
                    <p className="text-blue-100 font-medium opacity-80">Zero-Knowledge Protected</p>
                </div>

                <div className="p-10">
                    {needsPassword ? (
                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div className="text-center mb-8">
                                <h2 className="text-xl font-bold text-gray-900 mb-2">Password Protected</h2>
                                <p className="text-gray-500 text-sm">This file is encrypted. Enter the shared password to unlock.</p>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Shared Password"
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4 text-lg focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
                                autoFocus
                            />
                            {error && <p className="text-red-500 text-sm font-bold text-center">⚠️ {error}</p>}
                            <button className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]">
                                Unlock & View
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-6 p-6 bg-blue-50/50 rounded-3xl border border-blue-100">
                                <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center text-4xl">
                                    {(file.mime_type || '').startsWith('image/') ? '🖼️' : '📄'}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-2xl font-black text-gray-900 truncate mb-1" title={file.original_filename}>
                                        {file.original_filename}
                                    </h2>
                                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest bg-white inline-block px-2 py-1 rounded-md shadow-sm">
                                        {(file.file_size / 1024 / 1024).toFixed(2)} MB • {file.mime_type || 'Unknown Type'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 text-center">
                                <p className="text-gray-500 text-sm italic font-medium">
                                    &quot;This file is encrypted in transit and at rest. The server never sees the contents. Decryption happens entirely in your browser.&quot;
                                </p>
                            </div>

                            <button
                                onClick={() => setShowLightbox(true)}
                                className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-2xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-500/30 active:scale-[0.98] group"
                            >
                                <span className="group-hover:mr-2 transition-all">Preview & Download</span>
                                <span className="inline-block transition-transform group-hover:translate-x-1">🚀</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showLightbox && file && decryptedKey && (
                <Lightbox
                    file={file}
                    isOpen={showLightbox}
                    onClose={() => setShowLightbox(false)}
                    customKey={decryptedKey}
                    shareToken={token}
                    initialParts={parts}
                    onDecryptionError={(err) => {
                        console.error('Share decryption error:', err);
                        alert('Check your password or link. Decryption failed.');
                    }}
                />
            )}
        </div>
    );
}
