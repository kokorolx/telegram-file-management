'use client';

import { useState, useEffect, useRef } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { blobCache } from '@/lib/secureImageCache'; // Use alias if possible or relative path

export default function SecureImage({ file, className, alt, ...props }) {
  const { masterPassword, encryptionKey, isUnlocked } = useEncryption();
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  // Clear local src when locked (Cache is cleared by Context)
  useEffect(() => {
    if (!isUnlocked) {
        setSrc(null);
    }
  }, [isUnlocked]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!file) return;

    // 1. If not encrypted, use direct URL
    if (!file.is_encrypted) {
      setSrc(`/api/download?file_id=${file.id}`);
      return;
    }

    // 2. If encrypted but locked, ensure src is null
    if (!isUnlocked || !masterPassword) {
      setSrc(null);
      return;
    }

    // 3. Check Cache
    if (blobCache.has(file.id)) {
      setSrc(blobCache.get(file.id).url);
      return;
    }

    // 4. Fetch and Create Blob
    async function fetchImage() {
      try {
        setLoading(true);
        setError(null);

        const { fetchFilePartMetadata, fetchAndDecryptFullFile } = await import('@/lib/clientDecryption');

        // 1. Fetch parts metadata (IVs, AuthTags)
        const parts = await fetchFilePartMetadata(file.id);

        // 2. Fetch and decrypt all chunks in parallel
        const blob = await fetchAndDecryptFullFile(file.id, encryptionKey, parts);

        const url = URL.createObjectURL(blob);

        // Update global cache immediately, regardless of mount state
        blobCache.set(file.id, { url, timestamp: Date.now() });

        if (mountedRef.current) {
          setSrc(url);
        }
      } catch (err) {
        console.error('SecureImage error:', err);
        if (mountedRef.current) setError(err.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    if (encryptionKey) {
        fetchImage();
    }

  }, [file.id, file.is_encrypted, masterPassword, encryptionKey, isUnlocked]);

  // Locked State
  if (file.is_encrypted && !isUnlocked) {
    return (
        <div className={`flex flex-col items-center justify-center bg-gray-100 text-gray-400 ${className}`} title="Vault Locked">
            <span className="text-2xl mb-1">🔒</span>
            <span className="text-[10px] font-medium">Locked</span>
        </div>
    );
  }

  if (error) {
    return (
        <div className={`flex flex-col items-center justify-center bg-red-50 text-red-500 ${className}`}>
             <span className="text-xs">Error</span>
        </div>
    );
  }

  if (!src || loading) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img src={src} alt={alt || file.original_filename} className={`object-cover ${className}`} {...props} />;
}
