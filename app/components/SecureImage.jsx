'use client';

import { useState, useEffect, useRef } from 'react';
import { useEncryption } from '../contexts/EncryptionContext';
import { blobCache } from '@/lib/secureImageCache';

export default function SecureImage({ file, className, alt, ...props }) {
  const { masterPassword, encryptionKey, isUnlocked } = useEncryption();
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);
  const mountedRef = useRef(true);

  // Intersection Observer for Lazy Loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Once visible, stay visible to allow fetch
        }
      },
      { threshold: 0.1, rootMargin: '200px' } // Load a bit early
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [file.id]);

  // Clear local src when locked (Cache is cleared by Context)
  useEffect(() => {
    if (!isUnlocked) {
        setSrc(null);
        // We don't reset isVisible here so that it can re-trigger immediately if still in view when unlocked
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

    // 1. If not encrypted, use direct URL immediately (browser handles native lazy loading if needed)
    if (!file.is_encrypted) {
      setSrc(`/api/download?file_id=${file.id}`);
      return;
    }

    // 2. If encrypted but locked or not visible yet, stop
    if (!isUnlocked || !masterPassword || !isVisible) {
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
      if (loading) return;
      try {
        setLoading(true);
        setError(null);

        const { fetchFilePartMetadata, fetchAndDecryptFullFile } = await import('@/lib/clientDecryption');

        // 1. Fetch parts metadata (IVs, AuthTags)
        const parts = await fetchFilePartMetadata(file.id);

        // 2. Fetch and decrypt all chunks in parallel (with concurrency limit in utility)
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

  }, [file.id, file.is_encrypted, masterPassword, encryptionKey, isUnlocked, isVisible]);

  // Locked State
  if (file.is_encrypted && !isUnlocked) {
    return (
        <div ref={containerRef} className={`flex flex-col items-center justify-center bg-gray-100 text-gray-400 ${className}`} title="Vault Locked">
            <span className="text-2xl mb-1">🔒</span>
            <span className="text-[10px] font-medium">Locked</span>
        </div>
    );
  }

  if (error) {
    return (
        <div ref={containerRef} className={`flex flex-col items-center justify-center bg-red-50 text-red-500 ${className}`}>
             <span className="text-xs">Error</span>
        </div>
    );
  }

  if (!src || loading) {
    return <div ref={containerRef} className={`animate-pulse bg-gray-200 ${className}`} />;
  }

  return <img ref={containerRef} src={src} alt={alt || file.original_filename} className={`object-cover ${className}`} {...props} />;
}

