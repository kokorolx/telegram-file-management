'use client';

import { useState, useEffect, useRef } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';

// Global cache for blob URLs to prevent flickering/re-fetching
// Key: fileId, Value: { url: string, timestamp: number }
const blobCache = new Map();

export default function SecureImage({ file, className, alt, ...props }) {
  const { masterKey } = useEncryption();
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
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

    // 2. If encrypted but no key, show placeholder or error state handled by UI
    if (!masterKey) {
      // We can't display it yet.
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
        const res = await fetch('/api/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_id: file.id,
            master_key: masterKey
          })
        });

        if (!res.ok) throw new Error('Failed to load secure image');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        if (mountedRef.current) {
          blobCache.set(file.id, { url, timestamp: Date.now() });
          setSrc(url);
        }
      } catch (err) {
        console.error('SecureImage error:', err);
        if (mountedRef.current) setError(err.message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    fetchImage();

  }, [file, masterKey]);

  if (file.is_encrypted && !masterKey) {
    return <div className={`flex items-center justify-center bg-gray-200 text-gray-400 ${className}`}>🔒 Locked</div>;
  }

  if (error) {
    return <div className={`flex items-center justify-center bg-gray-200 text-red-400 text-xs ${className}`}>Error</div>;
  }

  if (!src || loading) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img src={src} alt={alt || file.original_filename} className={className} {...props} />;
}
